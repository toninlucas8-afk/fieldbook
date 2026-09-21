// Il "ta-dum" dell'apertura, fatto con due note dal telefono stesso: non
// c'e' nessun file da scaricare. Se il telefono non vuole suonare da solo
// (capita finche' l'app non e' installata) non succede niente di male.
const SPENTO = 'silcom-apertura-muta'

export const suonoSpento = () => {
  try { return localStorage.getItem(SPENTO) === '1' } catch { return false }
}

export const cambiaSuono = (acceso) => {
  try { localStorage.setItem(SPENTO, acceso ? '0' : '1') } catch { /* modalita' anonima */ }
}

function nota (ctx, quando, frequenza, durata, volume) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(frequenza, quando)
  // un filo di calo: e' quello che fa il colpo sordo invece del fischio
  o.frequency.exponentialRampToValueAtTime(frequenza * 0.86, quando + durata)

  g.gain.setValueAtTime(0.0001, quando)
  g.gain.exponentialRampToValueAtTime(volume, quando + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, quando + durata)

  o.connect(g).connect(ctx.destination)
  o.start(quando)
  o.stop(quando + durata + 0.05)
}

export function taDum () {
  if (suonoSpento()) return
  try {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    const ctx = new Audio()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const ora = ctx.currentTime + 0.32
    nota(ctx, ora, 146.8, 0.40, 0.32)          // ta
    nota(ctx, ora + 0.26, 293.7, 0.75, 0.30)   // dum
    setTimeout(() => ctx.close().catch(() => {}), 2500)
  } catch { /* il telefono non vuole suonare: pazienza */ }
}
