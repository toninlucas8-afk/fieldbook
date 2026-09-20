import express from 'express'
import {
  cambiaPin, creaUtente, generaPin, login, logout, normalizzaNome,
  richiediAdmin, richiediLogin, impostaCookie
} from './auth.js'
import { q, uno } from './db.js'
import { apriFlusso, eventiDopo, pubblica } from './eventi.js'
import { elimina, estensionePer, nuovaChiave, provaMagazzino, urlPerCaricare, urlPerVedere } from './r2.js'

export const api = express.Router()

const avvolgi = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const testoPulito = (v, max = 500) => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

/* ---------------------------------------------------------------- accesso */

api.post('/login', avvolgi(async (req, res) => {
  const { token, utente } = await login({
    nome: req.body?.nome,
    pin: req.body?.pin,
    dispositivo: req.get('user-agent')
  })
  impostaCookie(res, token)
  res.json({ utente })
}))

api.post('/logout', avvolgi(async (req, res) => {
  await logout(req, res)
  res.json({ ok: true })
}))

api.get('/io', richiediLogin, (req, res) => res.json({ utente: req.utente }))

api.post('/io/pin', richiediLogin, avvolgi(async (req, res) => {
  await cambiaPin(req.utente.id, req.body?.pin)
  res.json({ ok: true, avviso: 'PIN cambiato. Devi rientrare su tutti i tuoi telefoni.' })
}))

/* -------------------------------------------------- aggiornamenti dal vivo */

api.get('/eventi', richiediLogin, avvolgi(async (req, res) => {
  const dopo = Number(req.get('last-event-id') || req.query.dopo || 0)
  apriFlusso(req, res)
  // Chi era senza campo recupera qui quello che si e' perso.
  for (const evento of await eventiDopo(dopo)) {
    res.write(`id: ${evento.id}\ndata: ${JSON.stringify(evento)}\n\n`)
  }
}))

/* ----------------------------------------------------------- diagnostica */

// Aprendo questo indirizzo nel browser, da amministratore, si vede subito
// se il magazzino foto funziona e, se non funziona, perche'.
api.get('/diagnostica', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const magazzino = await provaMagazzino()
  res.status(magazzino.ok ? 200 : 503).json({
    database: 'ok',
    magazzino_foto: magazzino
  })
}))

/* ---------------------------------------------------------------- aziende */

api.get('/aziende', richiediLogin, avvolgi(async (req, res) => {
  res.json(await q(
    `select a.id, a.nome, a.colore, a.attiva,
            count(l.id) filter (where l.stato = 'in_corso')::int as lavori_in_corso
     from aziende a left join lavori l on l.azienda_id = a.id
     group by a.id order by a.attiva desc, a.nome`
  ))
}))

api.post('/aziende', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const nome = testoPulito(req.body?.nome, 120)
  if (!nome) return res.status(400).json({ errore: 'Serve il nome dell\'azienda' })
  const esiste = await uno('select id from aziende where lower(nome) = lower($1)', [nome])
  if (esiste) return res.status(409).json({ errore: 'Questa azienda c\'e\' gia\'' })
  const azienda = await uno(
    'insert into aziende (nome, colore) values ($1, $2) returning id, nome, colore, attiva',
    [nome, testoPulito(req.body?.colore, 20)]
  )
  res.status(201).json(azienda)
}))

api.patch('/aziende/:id', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const azienda = await uno(
    `update aziende set
       nome = coalesce($2, nome),
       colore = coalesce($3, colore),
       attiva = coalesce($4, attiva)
     where id = $1 returning id, nome, colore, attiva`,
    [req.params.id, testoPulito(req.body?.nome, 120), testoPulito(req.body?.colore, 20),
     typeof req.body?.attiva === 'boolean' ? req.body.attiva : null]
  )
  if (!azienda) return res.status(404).json({ errore: 'Azienda non trovata' })
  res.json(azienda)
}))

/* ----------------------------------------------------------------- lavori */

const SELECT_LAVORO = `
  select l.id, l.titolo, l.cliente_nome, l.cliente_cognome, l.cliente_telefono,
         l.indirizzo, l.note, l.stato, l.creato_il, l.aggiornato_il, l.concluso_il,
         l.azienda_id, a.nome as azienda_nome, a.colore as azienda_colore,
         u.nome as creato_da_nome,
         (select count(*) from foto f where f.lavoro_id = l.id)::int as foto_totali,
         (select count(*) from documenti d where d.lavoro_id = l.id)::int as documenti_totali,
         (select coalesce(f.chiave_mini, f.chiave) from foto f
           where f.lavoro_id = l.id
           order by f.caricata_il desc limit 1) as copertina_chiave,
         (select count(*) from annotazioni an
           where an.lavoro_id = l.id and not an.fatta)::int as annotazioni_aperte
  from lavori l
  left join aziende a on a.id = l.azienda_id
  left join utenti u on u.id = l.creato_da`

api.get('/lavori', richiediLogin, avvolgi(async (req, res) => {
  const stato = ['in_corso', 'concluso'].includes(req.query.stato) ? req.query.stato : null
  const cerca = testoPulito(req.query.q, 100)

  const righe = await q(
    `${SELECT_LAVORO}
     where ($1::text is null or l.stato = $1)
       and ($2::text is null or (
         l.titolo ilike '%' || $2 || '%' or l.indirizzo ilike '%' || $2 || '%'
         or l.cliente_nome ilike '%' || $2 || '%' or l.cliente_cognome ilike '%' || $2 || '%'
         or a.nome ilike '%' || $2 || '%'))
     order by (l.stato = 'in_corso') desc, l.aggiornato_il desc
     limit 200`,
    [stato, cerca]
  )

  res.json(await Promise.all(righe.map(async (r) => ({
    ...r, copertina_url: await urlPerVedere(r.copertina_chiave)
  }))))
}))

api.post('/lavori', richiediLogin, avvolgi(async (req, res) => {
  const titolo = testoPulito(req.body?.titolo, 200)
  if (!titolo) return res.status(400).json({ errore: 'Serve il titolo del lavoro' })

  const lavoro = await uno(
    `insert into lavori (titolo, azienda_id, cliente_nome, cliente_cognome,
                         cliente_telefono, indirizzo, note, creato_da)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [titolo, testoPulito(req.body?.azienda_id, 40), testoPulito(req.body?.cliente_nome, 100),
     testoPulito(req.body?.cliente_cognome, 100), testoPulito(req.body?.cliente_telefono, 40),
     testoPulito(req.body?.indirizzo, 300), testoPulito(req.body?.note, 4000), req.utente.id]
  )

  await pubblica('lavoro_creato', { lavoroId: lavoro.id, utenteId: req.utente.id, payload: { titolo } })
  res.status(201).json(await uno(`${SELECT_LAVORO} where l.id = $1`, [lavoro.id]))
}))

api.get('/lavori/:id', richiediLogin, avvolgi(async (req, res) => {
  const lavoro = await uno(`${SELECT_LAVORO} where l.id = $1`, [req.params.id])
  if (!lavoro) return res.status(404).json({ errore: 'Lavoro non trovato' })

  const [foto, documenti, annotazioni] = await Promise.all([
    q(`select f.id, f.chiave, f.chiave_mini, f.didascalia, f.larghezza, f.altezza,
              f.byte, f.scattata_il, f.caricata_il, f.caricata_da, u.nome as caricata_da_nome
       from foto f left join utenti u on u.id = f.caricata_da
       where f.lavoro_id = $1 order by f.caricata_il desc`, [req.params.id]),
    q(`select d.id, d.chiave, d.nome_file, d.tipo_mime, d.byte, d.caricato_il,
              d.caricato_da, u.nome as caricato_da_nome
       from documenti d left join utenti u on u.id = d.caricato_da
       where d.lavoro_id = $1 order by d.caricato_il desc`, [req.params.id]),
    q(`select a.id, a.testo, a.fatta, a.creata_il, a.chiusa_il, a.creata_da,
              u.nome as creata_da_nome, uc.nome as chiusa_da_nome
       from annotazioni a
       left join utenti u on u.id = a.creata_da
       left join utenti uc on uc.id = a.chiusa_da
       where a.lavoro_id = $1
       order by a.fatta asc, a.creata_il desc`, [req.params.id])
  ])

  res.json({
    ...lavoro,
    annotazioni,
    foto: await Promise.all(foto.map(async (f) => ({
      ...f,
      url_mini: await urlPerVedere(f.chiave_mini || f.chiave),
      url: await urlPerVedere(f.chiave)
    }))),
    documenti: await Promise.all(documenti.map(async (d) => ({
      ...d, url: await urlPerVedere(d.chiave, { nomeScaricato: d.nome_file })
    })))
  })
}))

api.patch('/lavori/:id', richiediLogin, avvolgi(async (req, res) => {
  const stato = ['in_corso', 'concluso'].includes(req.body?.stato) ? req.body.stato : null
  const lavoro = await uno(
    `update lavori set
       titolo = coalesce($2, titolo),
       azienda_id = coalesce($3, azienda_id),
       cliente_nome = coalesce($4, cliente_nome),
       cliente_cognome = coalesce($5, cliente_cognome),
       cliente_telefono = coalesce($6, cliente_telefono),
       indirizzo = coalesce($7, indirizzo),
       note = coalesce($8, note),
       stato = coalesce($9, stato),
       concluso_il = case when $9 = 'concluso' then coalesce(concluso_il, now())
                          when $9 = 'in_corso' then null else concluso_il end,
       aggiornato_il = now()
     where id = $1 returning id, stato`,
    [req.params.id, testoPulito(req.body?.titolo, 200), testoPulito(req.body?.azienda_id, 40),
     testoPulito(req.body?.cliente_nome, 100), testoPulito(req.body?.cliente_cognome, 100),
     testoPulito(req.body?.cliente_telefono, 40), testoPulito(req.body?.indirizzo, 300),
     testoPulito(req.body?.note, 4000), stato]
  )
  if (!lavoro) return res.status(404).json({ errore: 'Lavoro non trovato' })

  await pubblica('lavoro_aggiornato', { lavoroId: lavoro.id, utenteId: req.utente.id, payload: { stato: lavoro.stato } })
  res.json(await uno(`${SELECT_LAVORO} where l.id = $1`, [lavoro.id]))
}))

api.delete('/lavori/:id', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const chiavi = await q(
    `select chiave, chiave_mini from foto where lavoro_id = $1
     union all select chiave, null from documenti where lavoro_id = $1`,
    [req.params.id]
  )
  const eliminato = await uno('delete from lavori where id = $1 returning id', [req.params.id])
  if (!eliminato) return res.status(404).json({ errore: 'Lavoro non trovato' })

  for (const r of chiavi) { await elimina(r.chiave); await elimina(r.chiave_mini) }
  await pubblica('lavoro_eliminato', { utenteId: req.utente.id, payload: { id: req.params.id } })
  res.json({ ok: true })
}))

/* ------------------------------------------------------------------- foto */

// Passo 1: il telefono chiede dove caricare. Passo 2 (qui sotto) conferma.
api.post('/lavori/:id/foto/spazio', richiediLogin, avvolgi(async (req, res) => {
  const lavoro = await uno('select id from lavori where id = $1', [req.params.id])
  if (!lavoro) return res.status(404).json({ errore: 'Lavoro non trovato' })

  const tipoMime = testoPulito(req.body?.tipo_mime, 100) || 'image/jpeg'
  if (!tipoMime.startsWith('image/')) return res.status(400).json({ errore: 'Si caricano solo immagini' })

  const chiave = nuovaChiave('foto', lavoro.id, estensionePer(tipoMime))
  const chiaveMini = nuovaChiave('mini', lavoro.id, 'jpg')

  res.json({
    chiave,
    chiave_mini: chiaveMini,
    url_put: await urlPerCaricare(chiave, tipoMime),
    url_put_mini: await urlPerCaricare(chiaveMini, 'image/jpeg')
  })
}))

api.post('/lavori/:id/foto', richiediLogin, avvolgi(async (req, res) => {
  const chiave = testoPulito(req.body?.chiave, 300)
  if (!chiave) return res.status(400).json({ errore: 'Manca il riferimento del file' })
  if (!chiave.startsWith(`foto/${req.params.id}/`)) {
    return res.status(400).json({ errore: 'Riferimento del file non valido' })
  }

  const foto = await uno(
    `insert into foto (lavoro_id, chiave, chiave_mini, didascalia, larghezza,
                       altezza, byte, scattata_il, caricata_da)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, chiave, chiave_mini, didascalia, larghezza, altezza, byte, caricata_il`,
    [req.params.id, chiave, testoPulito(req.body?.chiave_mini, 300), testoPulito(req.body?.didascalia, 500),
     Number(req.body?.larghezza) || null, Number(req.body?.altezza) || null,
     Number(req.body?.byte) || null, req.body?.scattata_il || null, req.utente.id]
  )
  await q('update lavori set aggiornato_il = now() where id = $1', [req.params.id])

  const completa = {
    ...foto,
    caricata_da: req.utente.id,
    caricata_da_nome: req.utente.nome,
    url_mini: await urlPerVedere(foto.chiave_mini || foto.chiave),
    url: await urlPerVedere(foto.chiave)
  }
  // E' questo che fa comparire la foto sugli altri telefoni, senza ricaricare niente.
  await pubblica('foto_aggiunta', { lavoroId: req.params.id, utenteId: req.utente.id, payload: completa })
  res.status(201).json(completa)
}))

api.patch('/foto/:id', richiediLogin, avvolgi(async (req, res) => {
  const foto = await uno(
    'update foto set didascalia = $2 where id = $1 returning id, lavoro_id, didascalia',
    [req.params.id, testoPulito(req.body?.didascalia, 500)]
  )
  if (!foto) return res.status(404).json({ errore: 'Foto non trovata' })
  await pubblica('foto_aggiornata', { lavoroId: foto.lavoro_id, utenteId: req.utente.id, payload: foto })
  res.json(foto)
}))

api.delete('/foto/:id', richiediLogin, avvolgi(async (req, res) => {
  const foto = await uno('select id, lavoro_id, chiave, chiave_mini, caricata_da from foto where id = $1', [req.params.id])
  if (!foto) return res.status(404).json({ errore: 'Foto non trovata' })
  // La cancella chi l'ha caricata, oppure l'amministratore.
  if (req.utente.ruolo !== 'admin' && foto.caricata_da !== req.utente.id) {
    return res.status(403).json({ errore: 'Puoi cancellare solo le foto che hai caricato tu' })
  }

  await q('delete from foto where id = $1', [foto.id])
  await elimina(foto.chiave)
  await elimina(foto.chiave_mini)
  await pubblica('foto_eliminata', { lavoroId: foto.lavoro_id, utenteId: req.utente.id, payload: { id: foto.id } })
  res.json({ ok: true })
}))

/* -------------------------------------------------------------- documenti */

api.post('/lavori/:id/documenti/spazio', richiediLogin, avvolgi(async (req, res) => {
  const lavoro = await uno('select id from lavori where id = $1', [req.params.id])
  if (!lavoro) return res.status(404).json({ errore: 'Lavoro non trovato' })

  const nomeFile = testoPulito(req.body?.nome_file, 200) || 'documento'
  const tipoMime = testoPulito(req.body?.tipo_mime, 100) || 'application/octet-stream'
  const chiave = nuovaChiave('documenti', lavoro.id, estensionePer(tipoMime, nomeFile))

  res.json({ chiave, url_put: await urlPerCaricare(chiave, tipoMime) })
}))

api.post('/lavori/:id/documenti', richiediLogin, avvolgi(async (req, res) => {
  const chiave = testoPulito(req.body?.chiave, 300)
  if (!chiave?.startsWith(`documenti/${req.params.id}/`)) {
    return res.status(400).json({ errore: 'Riferimento del file non valido' })
  }

  const doc = await uno(
    `insert into documenti (lavoro_id, chiave, nome_file, tipo_mime, byte, caricato_da)
     values ($1, $2, $3, $4, $5, $6)
     returning id, chiave, nome_file, tipo_mime, byte, caricato_il`,
    [req.params.id, chiave, testoPulito(req.body?.nome_file, 200) || 'documento',
     testoPulito(req.body?.tipo_mime, 100), Number(req.body?.byte) || null, req.utente.id]
  )
  await q('update lavori set aggiornato_il = now() where id = $1', [req.params.id])

  const completo = {
    ...doc,
    caricato_da_nome: req.utente.nome,
    url: await urlPerVedere(doc.chiave, { nomeScaricato: doc.nome_file })
  }
  await pubblica('documento_aggiunto', { lavoroId: req.params.id, utenteId: req.utente.id, payload: completo })
  res.status(201).json(completo)
}))

api.delete('/documenti/:id', richiediLogin, avvolgi(async (req, res) => {
  const doc = await uno('select id, lavoro_id, chiave, caricato_da from documenti where id = $1', [req.params.id])
  if (!doc) return res.status(404).json({ errore: 'Documento non trovato' })
  if (req.utente.ruolo !== 'admin' && doc.caricato_da !== req.utente.id) {
    return res.status(403).json({ errore: 'Puoi cancellare solo i documenti che hai caricato tu' })
  }

  await q('delete from documenti where id = $1', [doc.id])
  await elimina(doc.chiave)
  await pubblica('documento_eliminato', { lavoroId: doc.lavoro_id, utenteId: req.utente.id, payload: { id: doc.id } })
  res.json({ ok: true })
}))

/* ------------------------------------------------------------ annotazioni */

// Cose mancanti, pezzi da ordinare, promemoria per chi passa dopo.
api.post('/lavori/:id/annotazioni', richiediLogin, avvolgi(async (req, res) => {
  const testo = testoPulito(req.body?.testo, 1000)
  if (!testo) return res.status(400).json({ errore: 'Scrivi che cosa serve' })

  const lavoro = await uno('select id from lavori where id = $1', [req.params.id])
  if (!lavoro) return res.status(404).json({ errore: 'Lavoro non trovato' })

  const nota = await uno(
    `insert into annotazioni (lavoro_id, testo, creata_da)
     values ($1, $2, $3)
     returning id, testo, fatta, creata_il`,
    [req.params.id, testo, req.utente.id]
  )
  await q('update lavori set aggiornato_il = now() where id = $1', [req.params.id])

  const completa = { ...nota, creata_da_nome: req.utente.nome }
  await pubblica('annotazione_aggiunta', { lavoroId: req.params.id, utenteId: req.utente.id, payload: completa })
  res.status(201).json(completa)
}))

api.patch('/annotazioni/:id', richiediLogin, avvolgi(async (req, res) => {
  const fatta = typeof req.body?.fatta === 'boolean' ? req.body.fatta : null

  const nota = await uno(
    `update annotazioni set
       testo = coalesce($2, testo),
       fatta = coalesce($3, fatta),
       chiusa_da = case when $3 = true then $4 when $3 = false then null else chiusa_da end,
       chiusa_il = case when $3 = true then now() when $3 = false then null else chiusa_il end
     where id = $1
     returning id, lavoro_id, testo, fatta, chiusa_il`,
    [req.params.id, testoPulito(req.body?.testo, 1000), fatta, req.utente.id]
  )
  if (!nota) return res.status(404).json({ errore: 'Annotazione non trovata' })

  await pubblica('annotazione_aggiornata', { lavoroId: nota.lavoro_id, utenteId: req.utente.id, payload: nota })
  res.json(nota)
}))

api.delete('/annotazioni/:id', richiediLogin, avvolgi(async (req, res) => {
  const nota = await uno('delete from annotazioni where id = $1 returning id, lavoro_id', [req.params.id])
  if (!nota) return res.status(404).json({ errore: 'Annotazione non trovata' })

  await pubblica('annotazione_eliminata', { lavoroId: nota.lavoro_id, utenteId: req.utente.id, payload: { id: nota.id } })
  res.json({ ok: true })
}))

/* ---------------------------------------------------------------- squadra */

api.get('/squadra', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  res.json(await q(
    `select u.id, u.nome, u.ruolo, u.attivo, u.creato_il, u.ultimo_accesso,
            (select count(*) from sessioni s where s.utente_id = u.id and s.scade_il > now())::int as telefoni,
            (select count(*) from foto f where f.caricata_da = u.id)::int as foto_caricate
     from utenti u order by u.attivo desc, u.nome`
  ))
}))

// Il PIN si vede una volta sola, qui: dopo resta solo cifrato nel database.
api.post('/squadra', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const pin = testoPulito(req.body?.pin, 8) || generaPin()
  const utente = await creaUtente({ nome: req.body?.nome, pin, ruolo: req.body?.ruolo === 'admin' ? 'admin' : 'montatore' })
  res.status(201).json({ ...utente, pin })
}))

api.post('/squadra/:id/pin', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const utente = await uno('select id, nome from utenti where id = $1', [req.params.id])
  if (!utente) return res.status(404).json({ errore: 'Persona non trovata' })

  const pin = testoPulito(req.body?.pin, 8) || generaPin()
  await cambiaPin(utente.id, pin)
  res.json({ ...utente, pin, avviso: 'PIN nuovo. I telefoni collegati prima devono rientrare.' })
}))

api.post('/squadra/:id/attivo', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const attivo = req.body?.attivo !== false
  if (req.params.id === req.utente.id && !attivo) {
    return res.status(400).json({ errore: 'Non puoi disattivare te stesso' })
  }

  const utente = await uno(
    'update utenti set attivo = $2 where id = $1 returning id, nome, attivo',
    [req.params.id, attivo]
  )
  if (!utente) return res.status(404).json({ errore: 'Persona non trovata' })
  // Revocare l'accesso deve avere effetto subito, non al prossimo giro.
  if (!attivo) await q('delete from sessioni where utente_id = $1', [utente.id])
  res.json(utente)
}))

api.get('/squadra/nome-libero', richiediLogin, richiediAdmin, avvolgi(async (req, res) => {
  const esiste = await uno('select id from utenti where nome_norm = $1', [normalizzaNome(req.query.nome)])
  res.json({ libero: !esiste })
}))
