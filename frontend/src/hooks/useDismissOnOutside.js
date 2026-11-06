import { useEffect } from 'react'

export function useDismissOnOutside(ref, isOpen, setIsOpen) {
  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, ref, setIsOpen])
}
