import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { clearAuthFeedback, requestPasswordReset, resetPassword } from '../../features/auth/authSlice.js'
import { ErrorMessage, FormField, FormHeading, PasswordButton, SubmitButton } from './FormControls.jsx'
import { OtpInputs } from './OtpForm.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ForgotPasswordForm({ initialEmail, onBack, onComplete }) {
  const dispatch = useDispatch()
  const { status, error } = useSelector((state) => state.auth)
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(initialEmail || '')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState('')
  const requestInFlight = useRef(false)
  const loading = status === 'loading'

  async function sendResetOtp() {
    if (requestInFlight.current) return false
    requestInFlight.current = true
    try {
      await dispatch(requestPasswordReset({ email: email.trim().toLowerCase() })).unwrap()
      return true
    } finally {
      requestInFlight.current = false
    }
  }

  async function requestOtp(event) {
    event.preventDefault()
    if (!emailPattern.test(email.trim())) {
      setValidationError('Enter a valid email address')
      return
    }

    try {
      if (await sendResetOtp()) {
        setStep('reset')
        setValidationError('')
      }
    } catch { /* Redux displays the server error. */ }
  }

  async function submitNewPassword(event) {
    event.preventDefault()
    if (otp.join('').length !== 6) {
      setValidationError('Please enter the complete 6-digit OTP')
      return
    }
    if (passwords.newPassword.length < 8) {
      setValidationError('New password must be at least 8 characters')
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setValidationError('Passwords do not match')
      return
    }

    try {
      await dispatch(resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.join(''),
        newPassword: passwords.newPassword,
      })).unwrap()
      onComplete()
    } catch { /* Redux displays the server error. */ }
  }

  function updatePassword(event) {
    const { name, value } = event.target
    setPasswords((current) => ({ ...current, [name]: value }))
    setValidationError('')
  }

  function goBack() {
    dispatch(clearAuthFeedback())
    if (step === 'reset') setStep('email')
    else onBack()
  }

  if (step === 'email') {
    return (
      <form className="auth-form" onSubmit={requestOtp} noValidate>
        <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={15} /> Back to sign in</button>
        <span className="mail-icon"><KeyRound size={23} /></span>
        <FormHeading title="Forgot password?" text="Enter your verified customer email and we will send a reset OTP." />
        <FormField label="Email address" type="email" placeholder="customer@example.com" icon={Mail} value={email} onChange={(event) => { setEmail(event.target.value); setValidationError('') }} />
        <ErrorMessage message={validationError || error} />
        <SubmitButton loading={loading}>Send reset OTP</SubmitButton>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={submitNewPassword} noValidate>
      <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={15} /> Change email</button>
      <FormHeading title="Reset password" text={`Enter the six-digit OTP sent to ${email}.`} />
      <OtpInputs digits={otp} onChange={(digits) => { setOtp(digits); setValidationError('') }} />
      <FormField label="New password" name="newPassword" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" icon={LockKeyhole} value={passwords.newPassword} onChange={updatePassword} action={<PasswordButton visible={showPassword} onClick={() => setShowPassword(!showPassword)} />} />
      <FormField label="Confirm new password" name="confirmPassword" type="password" placeholder="Repeat your new password" icon={ShieldCheck} value={passwords.confirmPassword} onChange={updatePassword} />
      <ErrorMessage message={validationError || error} />
      <SubmitButton loading={loading}>Reset password</SubmitButton>
      <p className="resend-copy">Did not receive the code? <button type="button" onClick={() => sendResetOtp().catch(() => {})}>Send again</button></p>
    </form>
  )
}
