import { useAuth } from './hooks/useAuth'
import { Auth } from './components/Auth'
import { ChatInterface } from './components/ChatInterface'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return !user ? <Auth /> : <ChatInterface user={user} />
}

export default App
