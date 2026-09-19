// Login con nome + PIN personale. Nessuna email, nessuna registrazione:
// l'amministratore crea la persona e le consegna il PIN.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { q, uno } from './db.js'

const COOKIE = 'fb_sessione'
const DURATA_SESSIONE_GIORNI = 180
const TENTATIVI_MAX = 5
const BLOCCO_MINUTI = 10

export function normalizzaNome (nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export function pinValido (pin) {
  return /^\d{4,8}$/.test(String(pin || ''))
}

export function generaPin () {
  // 6 cifre, sorteggiate senza sbilanciamenti.
  let pin = ''
  while (pin.length < 6) {
    const b = crypto.randomBytes(1)[0]
    if (b < 250) pin += String(b % 10)
  }
  return pin
}

export const hashPin = (pin) => bcrypt.hash(String(pin), 10)

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export async function creaUtente ({ nome, pin, ruolo = 'montatore' }) {
  const nomeNorm = normalizzaNome(nome)
  if (!nomeNorm) throw Object.assign(new Error('Il nome non puo\' essere vuoto'), { status: 400 })
  if (!pinValido(pin)) throw Object.assign(new Error('Il PIN deve essere da 4 a 8 cifre'), { status: 400 })

  const esiste = await uno('select id from utenti where nome_norm = $1', [nomeNorm])
  if (esiste) throw Object.assign(new Error('C\'e\' gia\' una persona con questo nome'), { status: 409 })

  return uno(
    `insert into utenti (nome, nome_norm, ruolo, pin_hash)
     values ($1, $2, $3, $4)
     returning id, nome, ruolo, attivo, creato_il`,
    [String(nome).trim(), nomeNorm, ruolo, await hashPin(pin)]
  )
}

export async function cambiaPin (utenteId, pin) {
  if (!pinValido(pin)) throw Object.assign(new Error('Il PIN deve essere da 4 a 8 cifre'), { status: 400 })
  await q(
    `update utenti
     set pin_hash = $2, pin_cambiato_il = now(), tentativi_falliti = 0, bloccato_fino = null
     where id = $1`,
    [utenteId, await hashPin(pin)]
  )
  // Un PIN nuovo caccia fuori i telefoni gia' collegati con quello vecchio.
  await q('delete from sessioni where utente_id = $1', [utenteId])
}

export async function login ({ nome, pin, dispositivo }) {
  const utente = await uno(
    `select id, nome, ruolo, pin_hash, attivo, tentativi_falliti, bloccato_fino
     from utenti where nome_norm = $1`,
    [normalizzaNome(nome)]
  )

  // Messaggio uguale in tutti i casi: non diciamo a un estraneo quali nomi esistono.
  const rifiuta = () => { throw Object.assign(new Error('Nome o PIN non corretti'), { status: 401 }) }

  if (!utente || !utente.attivo) {
    await bcrypt.compare(String(pin || ''), '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi')
    rifiuta()
  }

  if (utente.bloccato_fino && new Date(utente.bloccato_fino) > new Date()) {
    const minuti = Math.max(1, Math.ceil((new Date(utente.bloccato_fino) - new Date()) / 60000))
    throw Object.assign(
      new Error(`Troppi tentativi. Riprova tra ${minuti} minut${minuti === 1 ? 'o' : 'i'}.`),
      { status: 429 }
    )
  }

  if (!await bcrypt.compare(String(pin || ''), utente.pin_hash)) {
    const tentativi = utente.tentativi_falliti + 1
    if (tentativi >= TENTATIVI_MAX) {
      await q(
        `update utenti set tentativi_falliti = 0,
         bloccato_fino = now() + ($2 || ' minutes')::interval where id = $1`,
        [utente.id, String(BLOCCO_MINUTI)]
      )
    } else {
      await q('update utenti set tentativi_falliti = $2 where id = $1', [utente.id, tentativi])
    }
    rifiuta()
  }

  const token = crypto.randomBytes(32).toString('base64url')
  await q(
    `insert into sessioni (utente_id, token_hash, dispositivo, scade_il)
     values ($1, $2, $3, now() + ($4 || ' days')::interval)`,
    [utente.id, hashToken(token), String(dispositivo || '').slice(0, 200) || null, String(DURATA_SESSIONE_GIORNI)]
  )
  await q(
    'update utenti set tentativi_falliti = 0, bloccato_fino = null, ultimo_accesso = now() where id = $1',
    [utente.id]
  )

  return { token, utente: { id: utente.id, nome: utente.nome, ruolo: utente.ruolo } }
}

export function impostaCookie (res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURATA_SESSIONE_GIORNI * 24 * 60 * 60 * 1000,
    path: '/'
  })
}

export async function logout (req, res) {
  const token = req.cookies?.[COOKIE]
  if (token) await q('delete from sessioni where token_hash = $1', [hashToken(token)])
  res.clearCookie(COOKIE, { path: '/' })
}

// Il telefono resta riconosciuto: il PIN si ridigita solo se cambia
// telefono o se l'amministratore revoca l'accesso.
export async function richiediLogin (req, res, next) {
  try {
    const token = req.cookies?.[COOKIE]
    if (!token) return res.status(401).json({ errore: 'Devi entrare con nome e PIN' })

    const riga = await uno(
      `select s.id as sessione_id, u.id, u.nome, u.ruolo, u.attivo
       from sessioni s join utenti u on u.id = s.utente_id
       where s.token_hash = $1 and s.scade_il > now()`,
      [hashToken(token)]
    )
    if (!riga || !riga.attivo) {
      res.clearCookie(COOKIE, { path: '/' })
      return res.status(401).json({ errore: 'Devi entrare con nome e PIN' })
    }

    req.utente = { id: riga.id, nome: riga.nome, ruolo: riga.ruolo }
    q('update sessioni set ultimo_uso = now() where id = $1', [riga.sessione_id]).catch(() => {})
    next()
  } catch (e) { next(e) }
}

export function richiediAdmin (req, res, next) {
  if (req.utente?.ruolo !== 'admin') {
    return res.status(403).json({ errore: 'Serve il profilo da amministratore' })
  }
  next()
}

// Al primissimo avvio crea l'amministratore, altrimenti nessuno potrebbe entrare.
export async function creaAdminSeManca () {
  const { conteggio } = await uno('select count(*)::int as conteggio from utenti')
  if (conteggio > 0) return null

  const nome = process.env.ADMIN_NOME
  const pin = process.env.ADMIN_PIN
  if (!nome || !pin) {
    console.warn('Nessun utente nel database. Imposta ADMIN_NOME e ADMIN_PIN per creare il primo accesso.')
    return null
  }
  const admin = await creaUtente({ nome, pin, ruolo: 'admin' })
  console.log(`Creato l'amministratore "${admin.nome}". Cambia il PIN dall'app e togli ADMIN_PIN dalle variabili.`)
  return admin
}
