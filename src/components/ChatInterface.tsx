import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Message, ChatSession } from '../types'
import { User } from '@supabase/supabase-js'

interface ChatInterfaceProps {
  user: User
}

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id)
    }
  }, [currentSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error loading sessions:', error)
      return
    }

    setSessions(data || [])
    if (data && data.length > 0 && !currentSession) {
      setCurrentSession(data[0])
    }
  }

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    setMessages(data || [])
  }

  const createNewSession = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([
        {
          user_id: user.id,
          title: 'New Chat',
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return
    }

    if (data) {
      setSessions([data, ...sessions])
      setCurrentSession(data)
      setMessages([])
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !currentSession || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const { error: userMsgError } = await supabase.from('messages').insert([
      {
        session_id: currentSession.id,
        role: 'user',
        content: userMessage,
      },
    ])

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
      setLoading(false)
      return
    }

    await loadMessages(currentSession.id)

    const assistantResponse = generateMedicalResponse(userMessage)

    const { error: assistantMsgError } = await supabase.from('messages').insert([
      {
        session_id: currentSession.id,
        role: 'assistant',
        content: assistantResponse,
      },
    ])

    if (assistantMsgError) {
      console.error('Error saving assistant message:', assistantMsgError)
    }

    await loadMessages(currentSession.id)

    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSession.id)

    setLoading(false)
  }

  const generateMedicalResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase()

    if (lowerQuery.includes('headache')) {
      return 'For headaches, try resting in a quiet, dark room. Stay hydrated and consider over-the-counter pain relievers like acetaminophen or ibuprofen. If headaches persist or worsen, consult a healthcare provider.'
    }

    if (lowerQuery.includes('fever')) {
      return 'For fever, stay hydrated, rest, and monitor your temperature. Over-the-counter fever reducers like acetaminophen or ibuprofen can help. Seek medical attention if fever exceeds 103°F (39.4°C) or lasts more than 3 days.'
    }

    if (lowerQuery.includes('cold') || lowerQuery.includes('flu')) {
      return 'For cold or flu symptoms, get plenty of rest, stay hydrated, and use over-the-counter medications for symptom relief. Wash hands frequently and avoid close contact with others. Consult a doctor if symptoms worsen or persist beyond 10 days.'
    }

    if (lowerQuery.includes('cough')) {
      return 'For a cough, stay hydrated, use honey (for ages 1+), and consider cough suppressants. Avoid irritants like smoke. If cough persists beyond 3 weeks, produces blood, or is accompanied by fever, see a healthcare provider.'
    }

    return 'I understand you have a health concern. While I can provide general information, I recommend consulting with a qualified healthcare professional for personalized medical advice and proper diagnosis. Always seek immediate medical attention for emergencies.'
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>MediChat</h1>
          <p>AI Medical Assistant</p>
        </div>

        <button onClick={createNewSession} className="new-chat-btn">
          + New Chat
        </button>

        <div className="sessions-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
              onClick={() => setCurrentSession(session)}
            >
              {session.title}
            </div>
          ))}
        </div>

        <div className="user-section">
          <div className="user-info">{user.email}</div>
          <button onClick={handleLogout} className="logout-btn">
            Sign Out
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-header">
          <h2>{currentSession?.title || 'Select a chat'}</h2>
        </div>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>Start a conversation</h3>
              <p>
                Ask me anything about common health concerns, symptoms, or general medical
                information. Remember, I provide general guidance only.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {currentSession && (
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                className="message-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about symptoms, conditions, or general health..."
                rows={1}
                disabled={loading}
              />
              <button onClick={sendMessage} className="send-btn" disabled={loading || !input.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
