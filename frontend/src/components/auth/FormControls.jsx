import { Check, Eye, EyeOff, LoaderCircle } from 'lucide-react'

export function FormField({ label, icon: Icon, error, action, ...inputProps }) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      <span className={`input-box ${error ? 'has-error' : ''}`}>
        <Icon size={17} />
        <input {...inputProps} />
        {action}
      </span>
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function PasswordButton({ visible, onClick }) {
  return (
    <button className="password-button" type="button" onClick={onClick} aria-label={visible ? 'Hide password' : 'Show password'}>
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  )
}

export function Checkbox({ children, ...props }) {
  return (
    <label className="checkbox-label">
      <input type="checkbox" {...props} />
      <span className="checkbox"><Check size={11} /></span>
      <span>{children}</span>
    </label>
  )
}

export function SubmitButton({ loading, children }) {
  return (
    <button className="submit-button" disabled={loading}>
      {loading ? <LoaderCircle className="spin" size={18} /> : children}
    </button>
  )
}

export function ErrorMessage({ message }) {
  return message ? <div className="server-error">{message}</div> : null
}

export function SuccessMessage({ message }) {
  return message ? <div className="success-message"><Check size={14} />{message}</div> : null
}

export function FormHeading({ label, title, text }) {
  return (
    <header className="form-heading">
      {label && <span>{label}</span>}
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  )
}
