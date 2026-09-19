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

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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

export async function elimina (chiave) {
  if (!chiave) return
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chiave }))
  } catch (e) {
    console.warn('Non sono riuscito a cancellare da R2:', chiave, e.message)
  }
}
