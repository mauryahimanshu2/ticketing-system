import { useState } from 'react'
import { useSelector } from 'react-redux'
import { CheckCircle2 } from 'lucide-react'
import { formatPersonName } from '../utils/name.js'
import { Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout.jsx'
import { SignInForm } from '../components/auth/SignInForm.jsx'
import { SignUpForm } from '../components/auth/SignUpForm.jsx'

function AuthPage() {
  const [mode, setMode] = useState('signup')
  const [notice, setNotice] = useState('')
  const { status, user } = useSelector((state) => state.auth)

  function changeMode(nextMode) {
    setNotice('')
    setMode(nextMode)
  }

  function registrationComplete() {
    setNotice('Account created successfully. Please sign in to continue.')
    setMode('signin')
  }

  if (status === 'authenticated') {
    if (user?.role === 'user') return <Navigate to="/app" replace />
    if (user?.role === 'admin') return <Navigate to="/admin" replace />
    if (user?.role === 'agent') return <Navigate to="/agent" replace />
    return <main className="auth-page"><div className="login-success"><CheckCircle2 size={42} /><h1>Welcome, {formatPersonName(user?.name, 'back')}!</h1><p>The {user?.role} workspace is coming next.</p></div></main>
  }

  return (
    <AuthLayout mode={mode} onModeChange={changeMode}>
      {mode === 'signup'
        ? <SignUpForm onSignIn={() => changeMode('signin')} onVerified={registrationComplete} />
        : <SignInForm notice={notice} onSignUp={() => changeMode('signup')} />}
    </AuthLayout>
  )
}

export default AuthPage
