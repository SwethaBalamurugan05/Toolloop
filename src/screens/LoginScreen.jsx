import { Navigate, useNavigate } from 'react-router-dom'
import SignIn1 from '../components/ui/modern-stunning-sign-in'
import { useApp } from '../context/AppContext'

export default function LoginScreen() {
  const navigate = useNavigate()
  const { login, signup, user, authReady } = useApp()
  async function handleSignIn(email, password) {
    const result = await login(email, password)
    if (result.success) navigate('/home', { replace: true })
    return result
  }
  async function handleSignUp(fullName, email, password) {
    const result = await signup(fullName, email, password)
    if (result.success && !result.requiresEmailConfirmation) navigate('/home', { replace: true })
    return result
  }
  if (!authReady) return null
  if (user) return <Navigate to="/home" replace />
  return <SignIn1 onSignIn={handleSignIn} onSignUp={handleSignUp} />
}