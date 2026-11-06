import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { clearAuthFeedback, registerAccount, verifyRegistration } from '../../features/auth/authSlice.js'
import { Checkbox, ErrorMessage, FormField, FormHeading, PasswordButton, SubmitButton } from './FormControls.jsx'
import { OtpForm } from './OtpForm.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^\+[1-9]\d{6,14}$/

export function SignUpForm({ onSignIn, onVerified }) {
  const dispatch = useDispatch()
  const { status, error } = useSelector((state) => state.auth)
  const [step, setStep] = useState('details')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '', terms: false })
  const loading = status === 'loading'

  function updateForm(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function submitDetails(event) {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    try {
      await dispatch(registerAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/[\s().-]/g, ''),
        password: form.password,
      })).unwrap()
      setStep('otp')
    } catch { /* The Redux error is shown below the form. */ }
  }

  async function submitOtp(event) {
    event.preventDefault()
    if (otp.join('').length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP')
      return
    }
    try {
      await dispatch(verifyRegistration({ email: form.email.trim().toLowerCase(), otp: otp.join('') })).unwrap()
      onVerified()
    } catch { /* The Redux error is shown in the OTP form. */ }
  }

  if (step === 'otp') {
    return <OtpForm title="Verify your email" text="Enter the code sent to" email={form.email} digits={otp} loading={loading} error={otpError || error} onChange={(digits) => { setOtp(digits); setOtpError('') }} onSubmit={submitOtp} onBack={() => { setStep('details'); setOtpError(''); dispatch(clearAuthFeedback()) }} />
  }

  return (
    <form className="auth-form" onSubmit={submitDetails} noValidate>
      <FormHeading label="Customer registration" title="Create account" text="Fill your details. We’ll verify your email before creating the account." />

      <div className="two-fields">
        <FormField label="Full name" name="name" placeholder="John Doe" icon={UserRound} value={form.name} error={errors.name} onChange={updateForm} />
        <FormField label="Phone number" name="phone" placeholder="+91 98765 43210" icon={Phone} value={form.phone} error={errors.phone} onChange={updateForm} />
      </div>
      <FormField label="Email address" type="email" name="email" placeholder="john@example.com" icon={Mail} value={form.email} error={errors.email} onChange={updateForm} />
      <FormField label="Password" type={showPassword ? 'text' : 'password'} name="password" placeholder="Minimum 8 characters" icon={LockKeyhole} value={form.password} error={errors.password} onChange={updateForm} action={<PasswordButton visible={showPassword} onClick={() => setShowPassword(!showPassword)} />} />
      <FormField label="Confirm password" type="password" name="confirmPassword" placeholder="Repeat your password" icon={ShieldCheck} value={form.confirmPassword} error={errors.confirmPassword} onChange={updateForm} />

      <Checkbox name="terms" checked={form.terms} onChange={updateForm}>I agree to the Terms and Privacy Policy.</Checkbox>
      {errors.terms && <small className="field-error">{errors.terms}</small>}
      <ErrorMessage message={error} />
      <SubmitButton loading={loading}>Send verification OTP</SubmitButton>
      <p className="mobile-switch">Already registered? <button type="button" onClick={onSignIn}>Sign in</button></p>
    </form>
  )
}

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Full name is required'
  if (!phonePattern.test(form.phone.replace(/[\s().-]/g, ''))) errors.phone = 'Use format +919876543210'
  if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address'
  if (form.password.length < 8) errors.password = 'Use at least 8 characters'
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  if (!form.terms) errors.terms = 'Please accept the terms'
  return errors
}
