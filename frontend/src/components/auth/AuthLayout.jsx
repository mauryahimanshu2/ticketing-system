import { ArrowRight, Command, Headphones, Sparkles } from 'lucide-react'
import './auth.css'

export function AuthLayout({ mode, onModeChange, children }) {
  const isSignUp = mode === 'signup'

  return (
    <main className="auth-page">
      <section className="auth-card">
        <aside className="auth-hero">
          <div className="hero-content">
            <span className="hero-badge"><Sparkles size={14} /> Bitmax Support</span>

            <div>
              <p className="hero-kicker">{isSignUp ? 'Welcome' : 'Welcome back'}</p>
              <h2>{isSignUp ? 'Support made simple.' : 'Good to see you again.'}</h2>
              <p className="hero-copy">
                {isSignUp
                  ? 'Create your customer account, verify your email and get the help you need.'
                  : 'Sign in to track tickets, replies and every important update.'}
              </p>
            </div>

            <div className="hero-switch">
              <div className="hero-switch-copy">
                <Headphones size={20} />
                <span>
                  <strong>{isSignUp ? 'Already registered?' : 'New customer?'}</strong>
                  <small>{isSignUp ? 'Access your account' : 'Create a free account'}</small>
                </span>
              </div>
              <button type="button" onClick={() => onModeChange(isSignUp ? 'signin' : 'signup')}>
                {isSignUp ? 'Sign in' : 'Sign up'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="brand">
            <span><Command size={20} strokeWidth={2.8} /></span>
            <strong>Bitmax<i>.</i></strong>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
