import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Headphones, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { clearAuthFeedback, loginWithPassword, requestLoginOtp, verifyLoginOtp } from '../../features/auth/authSlice.js'
import { Checkbox, ErrorMessage, FormField, FormHeading, PasswordButton, SubmitButton, SuccessMessage } from './FormControls.jsx'
import { OtpForm } from './OtpForm.jsx'
import { ForgotPasswordForm } from './ForgotPasswordForm.jsx'
import { useAutoDismiss } from '../../hooks/useAutoDismiss.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const roles = [
  { value: 'user', label: 'Customer', icon: UserRound },
  { value: 'agent', label: 'Agent', icon: Headphones },
  { value: 'admin', label: 'Admin', icon: ShieldCheck },
]

const roleDetails = {
  user: {
    title: 'Customer sign in',
    text: 'Track your tickets and continue conversations with the support team.',
    emailPlaceholder: 'customer@example.com',
  },
  agent: {
    title: 'Agent workspace',
    text: 'Sign in with your verified support-agent account to manage assigned tickets.',
    emailPlaceholder: 'agent@company.com',
  },
  admin: {
    title: 'Admin console',
    text: 'Use your administrator credentials to manage users, agents and support operations.',
    emailPlaceholder: 'admin@company.com',
  },
}

export function SignInForm({ onSignUp, notice }) {
  const dispatch = useDispatch()
  const { status, error } = useSelector((state) => state.auth)
  const [role, setRole] = useState('user')
  const [method, setMethod] = useState('password')
  const [step, setStep] = useState('login')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [resetNotice, setResetNotice] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const loading = status === 'loading'
  const selectedRole = roleDetails[role]

  useAutoDismiss(error, () => dispatch(clearAuthFeedback()))

  function updateForm(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function changeRole(nextRole) {
    setRole(nextRole)
    if (nextRole !== 'user') setMethod('password')
    dispatch(clearAuthFeedback())
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!emailPattern.test(form.email.trim())) nextErrors.email = 'Enter a valid email address'
    if (method === 'password' && !form.password) nextErrors.password = 'Password is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    try {
      if (method === 'password') {
        await dispatch(loginWithPassword({ email: form.email.trim().toLowerCase(), password: form.password, expectedRole: role })).unwrap()
      } else {
        await dispatch(requestLoginOtp({ email: form.email.trim().toLowerCase() })).unwrap()
        setStep('otp')
      }
    } catch { /* Redux displays the server error. */ }
  }

  async function submitOtp(event) {
    event.preventDefault()
    if (otp.join('').length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP')
      return
    }
    try {
      await dispatch(verifyLoginOtp({ email: form.email.trim().toLowerCase(), otp: otp.join('') })).unwrap()
    } catch { /* Redux displays the server error. */ }
  }

  if (step === 'otp') {
    return <OtpForm title="Enter login code" text="Enter the code sent to" email={form.email} digits={otp} loading={loading} error={otpError || error} onChange={(digits) => { setOtp(digits); setOtpError('') }} onSubmit={submitOtp} onBack={() => { setStep('login'); setOtpError(''); dispatch(clearAuthFeedback()) }} onResend={() => dispatch(requestLoginOtp({ email: form.email.trim().toLowerCase() }))} />
  }

  if (step === 'forgot') {
    return <ForgotPasswordForm initialEmail={form.email} onBack={() => { setStep('login'); dispatch(clearAuthFeedback()) }} onComplete={() => { setStep('login'); setResetNotice('Password reset successfully. Sign in with your new password.'); dispatch(clearAuthFeedback()) }} />
  }

  return (
    <form className={`auth-form login-form role-${role}`} onSubmit={submit} noValidate>
      <FormHeading title={selectedRole.title} text={selectedRole.text} />
      <SuccessMessage message={notice || resetNotice} />

      <div className="role-selector">
        {roles.map(({ value, label, icon: Icon }) => (
          <button className={role === value ? 'active' : ''} key={value} type="button" onClick={() => changeRole(value)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {role === 'user' && (
        <div className="method-selector">
          <button className={method === 'password' ? 'active' : ''} type="button" onClick={() => { setMethod('password'); dispatch(clearAuthFeedback()) }}><LockKeyhole size={14} /> Password</button>
          <button className={method === 'otp' ? 'active' : ''} type="button" onClick={() => { setMethod('otp'); dispatch(clearAuthFeedback()) }}><KeyRound size={14} /> Email OTP</button>
        </div>
      )}

      <FormField label="Email address" type="email" name="email" placeholder={selectedRole.emailPlaceholder} icon={Mail} value={form.email} error={errors.email} onChange={updateForm} />
      {method === 'password' && <FormField label="Password" type={showPassword ? 'text' : 'password'} name="password" placeholder="Enter your password" icon={LockKeyhole} value={form.password} error={errors.password} onChange={updateForm} action={<PasswordButton visible={showPassword} onClick={() => setShowPassword(!showPassword)} />} />}
      {method === 'password' ? <div className="form-options"><Checkbox name="remember" checked={form.remember} onChange={updateForm}>Remember me</Checkbox>{role === 'user' && <button type="button" onClick={() => { setStep('forgot'); setResetNotice(''); dispatch(clearAuthFeedback()) }}>Forgot password?</button>}</div> : <p className="otp-help">We will send a one-time code to this verified customer email.</p>}

      <ErrorMessage message={error} />
      <SubmitButton loading={loading}>{method === 'password' ? `Sign in as ${roles.find((item) => item.value === role)?.label}` : 'Send login OTP'}</SubmitButton>
      <p className="mobile-switch">New customer? <button type="button" onClick={onSignUp}>Create account</button></p>
    </form>
  )
}
