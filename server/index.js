import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import { api, resocontoPubblico } from './api.js'
import { creaAdminSeManca } from './auth.js'
import { pulisciEventiVecchi } from './eventi.js'
import { applicaMigrazioni } from './migrazioni.js'
import { preparaAvvisi } from './avvisi.js'
import { paginaResoconto, paginaScaduta } from './resoconto.js'
import { q } from './db.js'

const qui = path.dirname(fileURLToPath(import.meta.url))
const cartellaWeb = path.join(qui, '..', 'web', 'dist')
const app = express()

app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/salute', (req, res) => res.json({ ok: true, ora: new Date().toISOString() }))
app.use('/api', api)

// Il resoconto per l'azienda: si apre senza account, con il link e basta.
app.get('/r/:token', async (req, res, next) => {
  try {
    const dati = await resocontoPubblico(req.params.token)
    res.set('X-Robots-Tag', 'noindex, nofollow')
    res.set('Cache-Control', 'no-store')
    if (!dati) return res.status(404).type('html').send(paginaScaduta())
    res.type('html').send(paginaResoconto(dati))
  } catch (e) { next(e) }
})

// L'app del telefono: file statici, e ogni altro indirizzo torna alla pagina
// principale perche' la navigazione la gestisce l'app stessa.
app.use(express.static(cartellaWeb, { maxAge: '1h', index: false }))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(cartellaWeb, 'index.html'), (err) => {
    if (err) res.status(503).send('App non ancora compilata. Esegui: npm run build')
  })
})

app.use((req, res) => res.status(404).json({ errore: 'Indirizzo non trovato' }))

app.use((err, req, res, next) => {
  const stato = err.status || 500
  if (stato >= 500) console.error(err)
  res.status(stato).json({ errore: stato >= 500 ? 'Errore del server' : err.message })
})

const porta = process.env.PORT || 3000

try {
  await q('select 1')
  await applicaMigrazioni()
  await creaAdminSeManca()
  await preparaAvvisi()
  pulisciEventiVecchi().catch(() => {})
  setInterval(() => pulisciEventiVecchi().catch(() => {}), 24 * 60 * 60 * 1000)
} catch (e) {
  console.error('Non riesco a collegarmi al database:', e.message)
  process.exit(1)
}

app.listen(porta, () => console.log(`Fieldbook in ascolto sulla porta ${porta}`))
