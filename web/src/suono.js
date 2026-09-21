// I suoni dell'app, fatti dal telefono stesso: non c'e' nessun file da
// scaricare. Se il telefono non vuole suonare da solo (capita finche' l'app
// non e' installata) non succede niente di male.
const SPENTO = 'silcom-apertura-muta'

export const suonoSpento = () => {
  try { return localStorage.getItem(SPENTO) === '1' } catch { return false }
}

export const cambiaSuono = (acceso) => {
  try { localStorage.setItem(SPENTO, acceso ? '0' : '1') } catch { /* modalita' anonima */ }
}

let contesto = null

function audio () {
  if (contesto) return contesto
  const Audio = window.AudioContext || window.webkitAudioContext
  if (!Audio) return null
  contesto = new Audio()
  return contesto
}

function nota (ctx, quando, da, a, durata, volume, forma = 'sine') {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = forma
  o.frequency.setValueAtTime(da, quando)
  o.frequency.exponentialRampToValueAtTime(a, quando + durata)

  g.gain.setValueAtTime(0.0001, quando)
  g.gain.exponentialRampToValueAtTime(volume, quando + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, quando + durata)

  o.connect(g).connect(ctx.destination)
  o.start(quando)
  o.stop(quando + durata + 0.05)
}

// Il "ta-dum" dell'apertura.
export function taDum () {
  if (suonoSpento()) return
  try {
    const ctx = audio()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const ora = ctx.currentTime + 0.32
    nota(ctx, ora, 146.8, 126, 0.40, 0.32)
    nota(ctx, ora + 0.26, 293.7, 252, 0.75, 0.30)
  } catch { /* il telefono non vuole suonare: pazienza */ }
}

// I versi del gioco: un colpetto quando mangia, qualcosa di piu' allegro
// per i bonus, un tonfo quando finisce.
const VERSI = {
  mela: { da: 520, a: 760, durata: 0.09, volume: 0.10 },
  grossa: { da: 660, a: 1180, durata: 0.16, volume: 0.13 },
  turbo: { da: 380, a: 1250, durata: 0.20, volume: 0.13 },
  stella: { da: 880, a: 1500, durata: 0.22, volume: 0.12 },
  fine: { da: 240, a: 90, durata: 0.45, volume: 0.16, forma: 'triangle' }
}

export function verso (quale) {
  if (suonoSpento()) return
  const v = VERSI[quale]
  if (!v) return
  try {
    const ctx = audio()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    nota(ctx, ctx.currentTime, v.da, v.a, v.durata, v.volume, v.forma || 'sine')
  } catch { /* pazienza */ }
}
