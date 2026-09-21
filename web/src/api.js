// Tutte le chiamate al server passano da qui.

// Quando il telefono e' senza campo la fetch fallisce con un messaggio in
// inglese del browser. Lo trasformiamo in una frase nostra, marcata, cosi'
// chi la riceve sa che non e' un errore vero ma solo mancanza di linea.
export function senzaLinea (messaggio = 'Sei senza linea: riprova quando torna il campo.') {
  const e = new Error(messaggio)
  e.linea = true
  return e
}

async function chiamata (percorso, opzioni = {}) {
  let res
  try {
    res = await fetch(`/api${percorso}`, {
      credentials: 'same-origin',
      headers: opzioni.body ? { 'Content-Type': 'application/json' } : undefined,
      ...opzioni
    })
  } catch {
    throw senzaLinea()
  }

  if (res.status === 204) return null
  const dati = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errore = new Error(dati.errore || 'Qualcosa non ha funzionato')
    errore.stato = res.status
    throw errore
  }
  return dati
}

const get = (p) => chiamata(p)
const post = (p, corpo) => chiamata(p, { method: 'POST', body: JSON.stringify(corpo ?? {}) })
const patch = (p, corpo) => chiamata(p, { method: 'PATCH', body: JSON.stringify(corpo ?? {}) })
const elimina = (p) => chiamata(p, { method: 'DELETE' })

export const api = {
  io: () => get('/io'),
  entra: (nome, pin) => post('/login', { nome, pin }),
  esci: () => post('/logout'),
  cambiaMioPin: (pin) => post('/io/pin', { pin }),

  aziende: () => get('/aziende'),
  creaAzienda: (dati) => post('/aziende', dati),

  lavori: ({ stato, q, da, a, mio } = {}) => {
    const p = new URLSearchParams()
    if (stato) p.set('stato', stato)
    if (q) p.set('q', q)
    if (da) p.set('da', da)
    if (a) p.set('a', a)
    if (mio) p.set('mio', '1')
    return get(`/lavori${p.toString() ? `?${p}` : ''}`)
  },
  lavoro: (id) => get(`/lavori/${id}`),
  creaLavoro: (dati) => post('/lavori', dati),
  aggiornaLavoro: (id, dati) => patch(`/lavori/${id}`, dati),
  eliminaLavoro: (id) => elimina(`/lavori/${id}`),

  colleghi: () => get('/colleghi'),

  // Blocco note personale.
  note: () => get('/note'),
  creaNota: (testo) => post('/note', { testo }),
  cambiaNota: (id, dati) => patch(`/note/${id}`, dati),
  eliminaNota: (id) => elimina(`/note/${id}`),
  togliNoteFatte: () => elimina('/note'),

  eliminaFirma: (id) => elimina(`/firme/${id}`),
  creaCondivisione: (lavoroId) => post(`/lavori/${lavoroId}/condivisioni`),
  eliminaCondivisione: (id) => elimina(`/condivisioni/${id}`),
  chiaveAvvisi: () => get('/avvisi/chiave'),
  provaAvvisi: () => post('/avvisi/prova'),
  programmaLavoro: (id, { data_lavoro, ora_lavoro }) =>
    chiamata(`/lavori/${id}/programma`, {
      method: 'PUT',
      body: JSON.stringify({ data_lavoro: data_lavoro || null, ora_lavoro: ora_lavoro || null })
    }),
  mettiInSquadra: (id, utenteId) => post(`/lavori/${id}/squadra`, { utente_id: utenteId }),
  togliDaSquadra: (id, utenteId) => elimina(`/lavori/${id}/squadra/${utenteId}`),

  didascaliaFoto: (id, didascalia) => patch(`/foto/${id}`, { didascalia }),
  eliminaFoto: (id) => elimina(`/foto/${id}`),
  eliminaDocumento: (id) => elimina(`/documenti/${id}`),

  creaAnnotazione: (lavoroId, testo) => post(`/lavori/${lavoroId}/annotazioni`, { testo }),
  segnaAnnotazione: (id, fatta) => patch(`/annotazioni/${id}`, { fatta }),
  eliminaAnnotazione: (id) => elimina(`/annotazioni/${id}`),

  squadra: () => get('/squadra'),
  creaPersona: (dati) => post('/squadra', dati),
  nuovoPin: (id, pin) => post(`/squadra/${id}/pin`, { pin }),
  attivaPersona: (id, attivo) => post(`/squadra/${id}/attivo`, { attivo })
}

/* ------------------------------------------------------- caricamento foto */

// La miniatura la prepara il telefono: nelle liste si scaricano 40 KB
// invece di 4 MB, cosi' in cantiere non si bruciano i giga.
function miniatura (file, latoMax = 900) {
  return new Promise((risolvi) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scala = Math.min(1, latoMax / Math.max(img.width, img.height))
      const tela = document.createElement('canvas')
      tela.width = Math.round(img.width * scala)
      tela.height = Math.round(img.height * scala)
      tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height)
      tela.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          risolvi({ blob, larghezza: img.width, altezza: img.height })
        },
        'image/jpeg',
        0.72
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); risolvi({ blob: null }) }
    img.src = url
  })
}

async function mettiSuR2 (url, corpo, tipoMime) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', body: corpo, headers: { 'Content-Type': tipoMime } })
  } catch {
    // Qui fetch fallisce senza risposta: o il telefono ha perso la rete, o il
    // magazzino foto non accetta le richieste da questo indirizzo.
    if (!navigator.onLine) throw senzaLinea()
    throw new Error(
      'Il magazzino foto ha rifiutato il collegamento. Se sei in cantiere con poco campo riprova, ' +
      'altrimenti manca il permesso sul bucket Cloudflare (criterio CORS).'
    )
  }
  if (!res.ok) {
    throw new Error(`Caricamento non riuscito (errore ${res.status}). Riprova.`)
  }
}

// L'originale va su Cloudflare senza passare dal server: e' piu' veloce
// e la foto resta a piena qualita'.
export async function caricaFoto (lavoroId, file, { didascalia } = {}) {
  const tipoMime = file.type || 'image/jpeg'
  const spazio = await post(`/lavori/${lavoroId}/foto/spazio`, { tipo_mime: tipoMime })
  const mini = await miniatura(file)

  await mettiSuR2(spazio.url_put, file, tipoMime)
  if (mini.blob) await mettiSuR2(spazio.url_put_mini, mini.blob, 'image/jpeg')

  return post(`/lavori/${lavoroId}/foto`, {
    chiave: spazio.chiave,
    chiave_mini: mini.blob ? spazio.chiave_mini : null,
    didascalia: didascalia || null,
    larghezza: mini.larghezza || null,
    altezza: mini.altezza || null,
    byte: file.size,
    scattata_il: file.lastModified ? new Date(file.lastModified).toISOString() : null
  })
}

export async function caricaDocumento (lavoroId, file) {
  const tipoMime = file.type || 'application/octet-stream'
  const spazio = await post(`/lavori/${lavoroId}/documenti/spazio`, { nome_file: file.name, tipo_mime: tipoMime })
  await mettiSuR2(spazio.url_put, file, tipoMime)
  return post(`/lavori/${lavoroId}/documenti`, {
    chiave: spazio.chiave, nome_file: file.name, tipo_mime: tipoMime, byte: file.size
  })
}

// La foto corretta prende il posto di quella vecchia: stesso posto
// nell'elenco, stessa didascalia, immagine nuova.
export async function ritoccaFoto (fotoId, immagine, { larghezza, altezza } = {}) {
  const spazio = await post(`/foto/${fotoId}/ritocco/spazio`)
  const mini = await miniatura(immagine)

  await mettiSuR2(spazio.url_put, immagine, 'image/jpeg')
  if (mini.blob) await mettiSuR2(spazio.url_put_mini, mini.blob, 'image/jpeg')

  return post(`/foto/${fotoId}/ritocco`, {
    chiave: spazio.chiave,
    chiave_mini: mini.blob ? spazio.chiave_mini : null,
    larghezza: larghezza || mini.larghezza || null,
    altezza: altezza || mini.altezza || null,
    byte: immagine.size
  })
}

// La firma disegnata sullo schermo segue la stessa strada delle foto.
export async function caricaFirma (lavoroId, immagine, dati) {
  const spazio = await post(`/lavori/${lavoroId}/firma/spazio`)
  await mettiSuR2(spazio.url_put, immagine, 'image/png')
  return post(`/lavori/${lavoroId}/firma`, { chiave: spazio.chiave, ...dati })
}

/* ------------------------------------------------- aggiornamenti dal vivo */

// Connessione sempre aperta col server: appena un collega carica una foto,
// arriva qui e compare sullo schermo senza toccare niente.
export function ascoltaEventi (quandoArriva) {
  let sorgente = null
  let chiusa = false

  const collega = () => {
    if (chiusa) return
    sorgente = new EventSource('/api/eventi')
    sorgente.onmessage = (e) => {
      try { quandoArriva(JSON.parse(e.data)) } catch { /* messaggio non leggibile */ }
    }
    sorgente.onerror = () => {
      sorgente.close()
      if (!chiusa) setTimeout(collega, 3000)
    }
  }

  collega()
  return () => { chiusa = true; sorgente?.close() }
}

/* ---------------------------------------------------- avvisi sul telefono */

const daBase64 = (base64) => {
  const pieno = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const grezzo = atob(pieno)
  return Uint8Array.from([...grezzo].map((c) => c.charCodeAt(0)))
}

export const avvisiPossibili = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Se questo telefono e' gia' iscritto agli avvisi.
export async function avvisiAttivi () {
  if (!avvisiPossibili() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(await reg?.pushManager.getSubscription())
}

export async function accendiAvvisi () {
  if (!avvisiPossibili()) {
    throw new Error('Questo telefono non sa mostrare gli avvisi. Su iPhone bisogna prima aggiungere l\'app alla schermata.')
  }
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') {
    throw new Error('Gli avvisi restano spenti. Puoi consentirli dalle impostazioni del telefono, alla voce notifiche.')
  }

  const reg = await navigator.serviceWorker.ready
  const { chiave } = await get('/avvisi/chiave')
  if (!chiave) throw new Error('Il server non ha ancora le chiavi degli avvisi. Riprova tra un minuto.')

  const iscrizione = await reg.pushManager.getSubscription() ||
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: daBase64(chiave) })

  await post('/avvisi/iscrivi', iscrizione.toJSON())
  return true
}

export async function spegniAvvisi () {
  const reg = await navigator.serviceWorker.getRegistration()
  const iscrizione = await reg?.pushManager.getSubscription()
  if (!iscrizione) return
  await post('/avvisi/disiscrivi', { endpoint: iscrizione.endpoint }).catch(() => {})
  await iscrizione.unsubscribe().catch(() => {})
}
