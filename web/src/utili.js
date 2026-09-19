export function quando (data) {
  if (!data) return ''
  const d = new Date(data)
  const minuti = Math.round((Date.now() - d) / 60000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return `${minuti} min fa`
  if (minuti < 60 * 24) return `${Math.round(minuti / 60)} h fa`
  const ieri = Math.round(minuti / (60 * 24))
  if (ieri === 1) return 'ieri'
  if (ieri < 7) return `${ieri} giorni fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function dataEstesa (data) {
  if (!data) return ''
  return new Date(data).toLocaleString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export const iniziali = (nome) =>
  String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

export function peso (byte) {
  if (!byte) return ''
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}

export const nomeCliente = (l) => [l.cliente_nome, l.cliente_cognome].filter(Boolean).join(' ')

// Apre le indicazioni stradali con l'app di mappe del telefono.
export const linkMappe = (indirizzo) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(indirizzo)}`
