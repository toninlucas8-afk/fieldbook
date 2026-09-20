// Tutte le chiamate al server passano da qui.
async function chiamata (percorso, opzioni = {}) {
  const res = await fetch(`/api${percorso}`, {
    credentials: 'same-origin',
    headers: opzioni.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opzioni
  })

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

  lavori: ({ stato, q } = {}) => {
    const p = new URLSearchParams()
    if (stato) p.set('stato', stato)
    if (q) p.set('q', q)
    return get(`/lavori${p.toString() ? `?${p}` : ''}`)
  },
  lavoro: (id) => get(`/lavori/${id}`),
  creaLavoro: (dati) => post('/lavori', dati),
  aggiornaLavoro: (id, dati) => patch(`/lavori/${id}`, dati),
  eliminaLavoro: (id) => elimina(`/lavori/${id}`),

  didascaliaFoto: (id, didascalia) => patch(`/foto/${id}`, { didascalia }),
  eliminaFoto: (id) => elimina(`/foto/${id}`),
  eliminaDocumento: (id) => elimina(`/documenti/${id}`),

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
    // Qui fetch fallisce senza risposta: o il magazzino foto non accetta
    // ancora le richieste da questo indirizzo, o il telefono ha perso la rete.
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
