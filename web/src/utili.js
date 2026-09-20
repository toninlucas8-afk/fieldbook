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

/* ------------------------------------------------------------------ date */

// Il giorno lo calcola il telefono, non il server: il server sta su un
// altro fuso orario e "oggi" deve essere oggi qui in cantiere.
export function giornoISO (d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function piuGiorni (iso, quanti) {
  const [a, m, g] = iso.split('-').map(Number)
  return giornoISO(new Date(a, m - 1, g + quanti))
}

const dataDa = (iso) => {
  const [a, m, g] = String(iso).split('-').map(Number)
  return new Date(a, m - 1, g)
}

// "Oggi", "Domani", "Ieri", altrimenti "lunedi' 22 settembre".
export function etichettaGiorno (iso, { lungo = true } = {}) {
  if (!iso) return 'Senza data'
  const oggi = giornoISO()
  if (iso === oggi) return 'Oggi'
  if (iso === piuGiorni(oggi, 1)) return 'Domani'
  if (iso === piuGiorni(oggi, -1)) return 'Ieri'
  const d = dataDa(iso)
  return d.toLocaleDateString('it-IT', lungo
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' })
}

// Titolo del gruppo in agenda: "Oggi, lunedi' 22 settembre".
export function titoloGiorno (iso) {
  if (!iso) return 'Senza data'
  const corta = etichettaGiorno(iso)
  if (corta !== 'Oggi' && corta !== 'Domani' && corta !== 'Ieri') {
    return corta.charAt(0).toUpperCase() + corta.slice(1)
  }
  const esteso = dataDa(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${corta}, ${esteso}`
}

// Data e ora messe insieme, come si dicono: "Oggi 8:30".
export function quandoLavoro (l, { lungo = false } = {}) {
  if (!l.data_lavoro) return ''
  const g = etichettaGiorno(l.data_lavoro, { lungo })
  return l.ora_lavoro ? `${g} ${l.ora_lavoro}` : g
}
