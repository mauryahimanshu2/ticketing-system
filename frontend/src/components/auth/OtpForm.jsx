import { ArrowLeft, Mail } from 'lucide-react'
import { ErrorMessage, FormHeading, SubmitButton } from './FormControls.jsx'

export function OtpInputs({ digits, onChange }) {
  function updateDigit(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    onChange(digits.map((item, currentIndex) => currentIndex === index ? digit : item))
    if (digit) document.getElementById(`otp-${index + 1}`)?.focus()
  }

  function handleKey(event, index) {
    if (event.key === 'Backspace' && !digits[index]) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  return (
    <div className="otp-inputs">
      {digits.map((digit, index) => (
        <input
          key={index}
          id={`otp-${index}`}
          inputMode="numeric"
          maxLength="1"
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKey(event, index)}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  )
}

export function OtpForm({ title, text, email, digits, loading, error, onChange, onSubmit, onBack, onResend }) {

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
      <span className="mail-icon"><Mail size={23} /></span>
      <FormHeading label="Email verification" title={title} text={`${text} ${email}`} />

      <OtpInputs digits={digits} onChange={onChange} />

      <ErrorMessage message={error} />
      <SubmitButton loading={loading}>Verify OTP</SubmitButton>
      {onResend && <p className="resend-copy">Did not receive the code? <button type="button" onClick={onResend}>Send again</button></p>}
    </form>
  )
}
