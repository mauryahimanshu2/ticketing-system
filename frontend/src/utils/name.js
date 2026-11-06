export function formatPersonName(name, fallback = '') {
  const value = String(name || '').trim().replace(/\s+/g, ' ')
  if (!value) return fallback

  return value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function personInitials(name, fallback = 'User') {
  return formatPersonName(name, fallback)
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}
