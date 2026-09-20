// Avvisi sul telefono (notifiche push del browser).
//
// Le chiavi VAPID, che servono a firmare gli avvisi, le genera il server da
// solo al primo avvio e restano nel database: cosi' non c'e' niente da
// incollare a mano in nessun pannello, e non cambiano a ogni riavvio (se
// cambiassero, tutti i telefoni gia' iscritti smetterebbero di ricevere).
import webpush from 'web-push'
import { q, uno } from './db.js'

let chiavi = null

export async function preparaAvvisi () {
  const riga = await uno("select valore from impostazioni where chiave = 'vapid'")
  if (riga) {
    chiavi = riga.valore
  } else {
    const nuove = webpush.generateVAPIDKeys()
    await q(
      `insert into impostazioni (chiave, valore) values ('vapid', $1)
       on conflict (chiave) do nothing`,
      [JSON.stringify(nuove)]
    )
    chiavi = (await uno("select valore from impostazioni where chiave = 'vapid'")).valore
  }

  // Il "soggetto" dice ai servizi di notifica chi sta mandando: non e' un
  // segreto, e' solo un recapito dell'app.
  const recapito = process.env.APP_URL?.trim() || 'https://fieldbook-zjhy.onrender.com'
  webpush.setVapidDetails(recapito, chiavi.publicKey, chiavi.privateKey)
  console.log('Avvisi sul telefono pronti.')
  return chiavi.publicKey
}

export const chiavePubblica = () => chiavi?.publicKey || null

export async function iscrivi (utenteId, iscrizione, dispositivo) {
  const { endpoint, keys } = iscrizione || {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null

  return uno(
    `insert into iscrizioni_push (utente_id, endpoint, p256dh, auth, dispositivo)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set utente_id = excluded.utente_id,
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           dispositivo = excluded.dispositivo
     returning id`,
    [utenteId, endpoint, keys.p256dh, keys.auth, dispositivo?.slice(0, 200) || null]
  )
}

export const disiscrivi = (endpoint) =>
  q('delete from iscrizioni_push where endpoint = $1', [endpoint])

// Manda l'avviso a delle persone. Non blocca mai chi ha fatto l'azione:
// se un telefono non risponde, il lavoro e' gia' stato salvato lo stesso.
export async function avvisa (utentiIds, { titolo, testo, lavoroId, tag }) {
  const destinatari = [...new Set((utentiIds || []).filter(Boolean))]
  if (!chiavi || destinatari.length === 0) return { inviati: 0 }

  const iscrizioni = await q(
    'select id, endpoint, p256dh, auth from iscrizioni_push where utente_id = any($1::uuid[])',
    [destinatari]
  )
  if (iscrizioni.length === 0) return { inviati: 0 }

  const corpo = JSON.stringify({
    titolo,
    testo,
    url: lavoroId ? `/?lavoro=${lavoroId}` : '/',
    tag: tag || (lavoroId ? `lavoro-${lavoroId}` : 'fieldbook')
  })

  let inviati = 0
  await Promise.all(iscrizioni.map(async (i) => {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        corpo,
        { TTL: 60 * 60 * 12 }
      )
      inviati++
      await q('update iscrizioni_push set ultimo_invio = now() where id = $1', [i.id])
    } catch (e) {
      // 404 e 410 vogliono dire che quel telefono non esiste piu':
      // togliamo l'iscrizione invece di riprovare per sempre.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await q('delete from iscrizioni_push where id = $1', [i.id])
      } else {
        console.error('Avviso non partito:', e.statusCode || e.message)
      }
    }
  }))

  return { inviati }
}

// Chi va a fare il lavoro, tranne chi ha appena fatto l'azione.
export async function squadraDelLavoro (lavoroId, senza) {
  const righe = await q(
    'select utente_id from assegnazioni where lavoro_id = $1 and utente_id <> $2',
    [lavoroId, senza]
  )
  return righe.map((r) => r.utente_id)
}
