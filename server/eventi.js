// Tiene aperte le connessioni dei telefoni e spinge gli aggiornamenti
// appena qualcuno carica una foto o cambia un lavoro.
import { q, uno } from './db.js'

const connessioni = new Set()

export function registraConnessione (res) {
  connessioni.add(res)
  res.on('close', () => connessioni.delete(res))
}

function spedisci (res, evento) {
  res.write(`id: ${evento.id}\n`)
  res.write(`data: ${JSON.stringify(evento)}\n\n`)
}

// Scrive l'evento nel database (cosi' chi era senza campo lo recupera dopo)
// e lo manda subito a chi e' collegato adesso.
export async function pubblica (tipo, { lavoroId = null, utenteId = null, payload = {} } = {}) {
  const evento = await uno(
    `insert into eventi (lavoro_id, tipo, payload, utente_id)
     values ($1, $2, $3, $4)
     returning id, lavoro_id, tipo, payload, utente_id, creato_il`,
    [lavoroId, tipo, payload, utenteId]
  )
  for (const res of connessioni) {
    try { spedisci(res, evento) } catch { connessioni.delete(res) }
  }
  return evento
}

export async function eventiDopo (ultimoId) {
  if (!ultimoId) return []
  return q(
    `select id, lavoro_id, tipo, payload, utente_id, creato_il
     from eventi where id > $1 order by id asc limit 200`,
    [ultimoId]
  )
}

export function apriFlusso (req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write('retry: 3000\n\n')
  registraConnessione(res)

  // Battito ogni 25 secondi: senza, i proxy chiudono la connessione ferma.
  const battito = setInterval(() => {
    try { res.write(': battito\n\n') } catch { clearInterval(battito) }
  }, 25_000)
  res.on('close', () => clearInterval(battito))
}

// Pulizia: lo storico eventi serve solo a recuperare qualche ora di buco.
export async function pulisciEventiVecchi () {
  await q("delete from eventi where creato_il < now() - interval '7 days'")
}
