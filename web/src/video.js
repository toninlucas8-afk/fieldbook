// I video del cantiere.
//
// Un video girato col telefono pesa anche 60 MB per mezzo minuto: troppo
// per la linea di un garage e per il magazzino. Qui lo rifacciamo piu'
// leggero prima di mandarlo su, senza scendere troppo di qualita': i
// dettagli del montaggio si devono vedere.
//
// Il lavoro lo fa il telefono: il video viene riprodotto di nascosto, ogni
// fotogramma finisce su una tela piu' piccola e da li' si registra. Per
// questo ci mette quanto dura il video, non di piu'.

export const SECONDI_MAX = 30
const LATO_MAX = 1280           // il lato lungo: 720p, basta per vedere i dettagli
const BIT_AL_SECONDO = 2_200_000 // circa 8 MB per mezzo minuto

const pari = (n) => Math.max(2, Math.round(n / 2) * 2)

export const sonoBuono = () =>
  typeof MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  !!HTMLCanvasElement.prototype.captureStream

// Prima l'mp4: e' quello che si apre dappertutto, anche sugli iPhone di chi
// riceve il resoconto. Il webm resta come riserva.
const formato = () =>
  ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9',
    'video/webm;codecs=vp8', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported?.(t)) || ''

// Il primo fotogramma, che serve da copertina nell'elenco e nel resoconto.
function fotogramma (tela, ctx, video, quando) {
  return new Promise((risolvi) => {
    const preso = () => {
      ctx.drawImage(video, 0, 0, tela.width, tela.height)
      tela.toBlob((blob) => risolvi(blob), 'image/jpeg', 0.72)
    }
    video.onseeked = preso
    try { video.currentTime = quando } catch { preso() }
  })
}

export function apriVideo (file) {
  return new Promise((risolvi, rifiuta) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => risolvi(video)
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      rifiuta(new Error('Non riesco ad aprire questo video. Provane un altro.'))
    }
  })
}

// Torna il video alleggerito, il fotogramma di copertina e quanto dura.
// `avanzamento` viene chiamato con un numero da 0 a 1, per la barra.
export async function preparaVideo (file, avanzamento = () => {}) {
  if (!sonoBuono()) {
    throw new Error('Questo telefono non riesce a preparare i video. Aggiorna Chrome e riprova.')
  }

  const video = await apriVideo(file)
  const interi = Number.isFinite(video.duration) ? video.duration : SECONDI_MAX
  const durata = Math.min(interi, SECONDI_MAX)
  const tagliato = interi > SECONDI_MAX + 0.4

  const scala = Math.min(1, LATO_MAX / Math.max(video.videoWidth, video.videoHeight))
  const tela = document.createElement('canvas')
  tela.width = pari(video.videoWidth * scala)
  tela.height = pari(video.videoHeight * scala)
  const ctx = tela.getContext('2d')

  const poster = await fotogramma(tela, ctx, video, Math.min(0.4, durata / 4))

  const flusso = tela.captureStream(30)
  const mime = formato()
  const registratore = new MediaRecorder(flusso, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: BIT_AL_SECONDO
  })

  const pezzi = []
  registratore.ondataavailable = (e) => { if (e.data?.size) pezzi.push(e.data) }
  const finito = new Promise((risolvi) => { registratore.onstop = risolvi })

  // si riparte dall'inizio e si registra quello che passa sulla tela
  await new Promise((ok) => { video.onseeked = ok; video.currentTime = 0 })
  video.onseeked = null

  registratore.start(1000)
  try { await video.play() } catch { /* parte comunque col disegno */ }

  let chiuso = false
  const chiudi = () => {
    if (chiuso) return
    chiuso = true
    video.pause()
    if (registratore.state !== 'inactive') registratore.stop()
  }

  // una rete di sicurezza: se il video si inchioda, non restiamo qui per sempre
  const salvagente = setTimeout(chiudi, (durata + 6) * 1000)

  const disegna = () => {
    if (chiuso) return
    ctx.drawImage(video, 0, 0, tela.width, tela.height)
    avanzamento(Math.min(0.99, video.currentTime / durata))
    if (video.currentTime >= durata || video.ended) return chiudi()
    requestAnimationFrame(disegna)
  }
  requestAnimationFrame(disegna)

  await finito
  clearTimeout(salvagente)
  URL.revokeObjectURL(video.src)
  avanzamento(1)

  const tipoMime = (registratore.mimeType || mime || 'video/webm').split(';')[0]
  const alleggerito = new Blob(pezzi, { type: tipoMime })

  if (!alleggerito.size) throw new Error('Il video non si è preparato. Riprova.')

  return {
    video: alleggerito,
    poster,
    durata: Math.round(durata * 10) / 10,
    larghezza: tela.width,
    altezza: tela.height,
    tipoMime,
    tagliato,
    durataOriginale: Math.round(interi)
  }
}
