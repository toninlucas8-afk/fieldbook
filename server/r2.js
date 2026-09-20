// Le foto stanno su Cloudflare R2. Le chiavi di accesso restano qui sul
// server: sui telefoni non arrivano mai.
import crypto from 'node:crypto'
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const richieste = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
const mancanti = richieste.filter((v) => !process.env[v])
if (mancanti.length) {
  console.error('Mancano le variabili di Cloudflare R2: ' + mancanti.join(', '))
  process.exit(1)
}

const BUCKET = process.env.R2_BUCKET
const MINUTI_LETTURA = 60
const MINUTI_SCRITTURA = 15

// I bucket creati con una giurisdizione (per esempio EU) non stanno
// sull'indirizzo normale ma su uno dedicato. In quel caso si passa
// l'indirizzo completo con R2_ENDPOINT, che si legge nelle impostazioni
// del bucket alla voce S3 API.
const endpoint = process.env.R2_ENDPOINT?.trim().replace(/\/+$/, '') ||
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

console.log(`Magazzino foto: bucket "${process.env.R2_BUCKET}" su ${endpoint}`)

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  // R2 vuole l'indirizzo con il bucket nel percorso, non come sottodominio.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

const ESTENSIONI = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf'
}

export function estensionePer (tipoMime, nomeFile = '') {
  if (ESTENSIONI[tipoMime]) return ESTENSIONI[tipoMime]
  const dalNome = String(nomeFile).split('.').pop()
  return /^[a-z0-9]{1,5}$/i.test(dalNome) ? dalNome.toLowerCase() : 'bin'
}

export function nuovaChiave (cartella, lavoroId, estensione) {
  return `${cartella}/${lavoroId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${estensione}`
}

// Il telefono carica dritto su R2 con questo link: il file non passa
// dal server, cosi' l'upload e' veloce anche con la linea del cantiere.
export function urlPerCaricare (chiave, tipoMime) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: chiave, ContentType: tipoMime }),
    { expiresIn: MINUTI_SCRITTURA * 60 }
  )
}

export function urlPerVedere (chiave, { nomeScaricato } = {}) {
  if (!chiave) return null
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: chiave,
      ...(nomeScaricato
        ? { ResponseContentDisposition: `attachment; filename="${nomeScaricato.replace(/"/g, '')}"` }
        : {})
    }),
    { expiresIn: MINUTI_LETTURA * 60 }
  )
}

// Se R2 rifiuta un caricamento, la sua risposta d'errore non porta le
// intestazioni CORS: il browser non riesce a leggerla e mostra un errore
// generico, identico a quello di un permesso mancante. Questa prova fa lo
// stesso giro dal server, dove l'errore vero si legge per intero.
function spiegaErrore (e) {
  const codice = e?.name || e?.Code || ''
  const stato = e?.$metadata?.httpStatusCode

  if (/InvalidAccessKeyId/i.test(codice)) {
    return "L'Access Key ID non e' riconosciuto da Cloudflare. Controlla R2_ACCESS_KEY_ID."
  }
  if (/SignatureDoesNotMatch/i.test(codice)) {
    return 'La chiave segreta non corrisponde al suo Access Key ID. Le due chiavi devono venire dallo stesso token.'
  }
  if (/NoSuchBucket/i.test(codice)) {
    return `Il bucket "${BUCKET}" non esiste a questo indirizzo. Controlla R2_BUCKET e R2_ENDPOINT.`
  }
  if (/AccessDenied|Forbidden/i.test(codice) || stato === 403) {
    return 'Il token non ha il permesso di scrivere su questo bucket. Serve Lettura e scrittura di oggetti sul bucket giusto.'
  }
  return `Errore non previsto: ${[codice, e?.message].filter(Boolean).join(' - ') || 'sconosciuto'}`
}

// Scrive un file finto e lo cancella subito: e' il modo piu' onesto di
// sapere se le chiavi funzionano davvero.
export async function provaMagazzino () {
  const chiave = `diagnostica/prova-${Date.now()}.txt`
  const inizio = Date.now()

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: chiave, Body: 'prova', ContentType: 'text/plain'
    }))
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chiave }))
    return {
      ok: true, bucket: BUCKET, endpoint,
      millisecondi: Date.now() - inizio,
      messaggio: 'Il magazzino foto risponde e accetta i file. Le chiavi sono giuste.'
    }
  } catch (e) {
    console.error('Prova del magazzino foto fallita:', e?.name, e?.message)
    return {
      ok: false, bucket: BUCKET, endpoint,
      codice: e?.name || null,
      stato: e?.$metadata?.httpStatusCode || null,
      messaggio: spiegaErrore(e)
    }
  }
}

export async function elimina (chiave) {
  if (!chiave) return
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chiave }))
  } catch (e) {
    console.warn('Non sono riuscito a cancellare da R2:', chiave, e.message)
  }
}
