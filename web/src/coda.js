// Foto scattate senza campo.
//
// In cantiere capita di essere in un garage o dentro un palazzo dove la
// linea non prende. Le foto scattate li' non si perdono: restano nella
// memoria del telefono e partono da sole appena torna il segnale.
import { caricaFoto } from './api.js'

const NOME_DB = 'fieldbook'
const DEPOSITO = 'foto-in-attesa'

function apri () {
  return new Promise((risolvi, rifiuta) => {
    const richiesta = indexedDB.open(NOME_DB, 1)
    richiesta.onupgradeneeded = () => {
      const db = richiesta.result
      if (!db.objectStoreNames.contains(DEPOSITO)) {
        db.createObjectStore(DEPOSITO, { keyPath: 'id', autoIncrement: true })
      }
    }
    richiesta.onsuccess = () => risolvi(richiesta.result)
    richiesta.onerror = () => rifiuta(richiesta.error)
  })
}

function operazione (modo, lavoro) {
  return apri().then((db) => new Promise((risolvi, rifiuta) => {
    const t = db.transaction(DEPOSITO, modo)
    const richiesta = lavoro(t.objectStore(DEPOSITO))
    richiesta.onsuccess = () => risolvi(richiesta.result)
    richiesta.onerror = () => rifiuta(richiesta.error)
    t.oncomplete = () => db.close()
  }))
}

export const accoda = (lavoroId, file) =>
  operazione('readwrite', (d) => d.add({
    lavoroId, file, nome: file.name || 'foto.jpg', messa_il: Date.now()
  }))

export const inAttesa = () => operazione('readonly', (d) => d.getAll()).catch(() => [])
const rimuovi = (id) => operazione('readwrite', (d) => d.delete(id))

/* ------------------------------------------------ chi vuole sapere quante */

const ascoltatori = new Set()
let ultimoStato = { totali: 0, per: {}, errore: '', sto: false }

export function ascoltaCoda (fn) {
  ascoltatori.add(fn)
  fn(ultimoStato)
  return () => ascoltatori.delete(fn)
}

function annuncia (nuovo) {
  ultimoStato = { ...ultimoStato, ...nuovo }
  for (const fn of ascoltatori) fn(ultimoStato)
}

export async function aggiornaConto (extra = {}) {
  const righe = await inAttesa()
  const per = {}
  for (const r of righe) per[r.lavoroId] = (per[r.lavoroId] || 0) + 1
  annuncia({ totali: righe.length, per, ...extra })
  return righe.length
}

/* ------------------------------------------------------- invio differito */

let staGirando = false

// Prova a mandare quello che e' rimasto indietro. Si ferma al primo
// fallimento: se manca ancora la linea, inutile insistere su tutte.
export async function svuotaCoda () {
  if (staGirando || !navigator.onLine) return
  staGirando = true
  annuncia({ sto: true })

  try {
    const righe = await inAttesa()
    for (const riga of righe) {
      try {
        await caricaFoto(riga.lavoroId, riga.file)
        await rimuovi(riga.id)
        await aggiornaConto({ errore: '' })
      } catch (e) {
        // Se manca ancora la linea non e' un errore da mostrare: le foto
        // restano dove sono e si riprova da soli piu' tardi.
        await aggiornaConto({ errore: sembraMancanzaDiLinea(e) ? '' : e.message })
        break
      }
    }
  } finally {
    staGirando = false
    annuncia({ sto: false })
  }
}

// Vale la pena tenere da parte una foto solo se il problema e' la linea:
// un rifiuto del server e' un errore vero e va mostrato subito.
export const sembraMancanzaDiLinea = (e) =>
  !navigator.onLine || e?.linea === true

// Manda la foto, e se non si puo' la mette in attesa del campo.
export async function mandaFotoOAccoda (lavoroId, file) {
  try {
    return await caricaFoto(lavoroId, file)
  } catch (e) {
    if (!sembraMancanzaDiLinea(e)) throw e
    await accoda(lavoroId, file)
    await aggiornaConto({ errore: '' })
    return { in_attesa: true }
  }
}
