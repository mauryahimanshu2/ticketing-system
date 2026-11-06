import { useEffect, useRef } from 'react'

export function useAutoDismiss(value, onDismiss, delay = 3000) {
  const dismissRef = useRef(onDismiss)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!value) return undefined
    const timer = window.setTimeout(() => dismissRef.current(), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
}
