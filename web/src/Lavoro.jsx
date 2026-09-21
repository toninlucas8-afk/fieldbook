import { useCallback, useEffect, useRef, useState } from 'react'
import { api, caricaDocumento } from './api.js'
import Firma from './Firma.jsx'
import Visore from './Foto.jsx'
import { ascoltaCoda, mandaFotoOAccoda, svuotaCoda } from './coda.js'
import { dataEstesa, iniziali, linkMappe, nomeCliente, peso, quando, soloData } from './utili.js'

export default function Lavoro ({ id, utente, indietro, segnale }) {
  const [lavoro, setLavoro] = useState(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(null)      // { fatte, totali }
  const [aperta, setAperta] = useState(null)    // quale foto e' aperta nel visore
  const [menu, setMenu] = useState(false)
  const [nuove, setNuove] = useState(() => new Set())
  const [nota, setNota] = useState('')
  const [referente, setReferente] = useState(null)  // { referente, referente_telefono }
  const [salvoNota, setSalvoNota] = useState(false)
  const [scegliChi, setScegliChi] = useState(false)
  const [colleghi, setColleghi] = useState([])
  const [faiFirmare, setFaiFirmare] = useState(false)
  const [copiato, setCopiato] = useState(false)
  const [coda, setCoda] = useState({ totali: 0, per: {}, errore: '', sto: false })

  const inputFoto = useRef(null)
  const inputFotocamera = useRef(null)
  const inputDoc = useRef(null)

  const segnala = useCallback((e) => setErrore(e.message), [])

  // Il rinfresco della scheda gira da solo, anche dopo aver messo una foto in
  // attesa. Se manca il campo non c'e' niente da segnalare: la scheda gialla
  // lo dice gia', e un avviso rosso in cima spaventerebbe e basta.
  const ricarica = useCallback(async () => {
    try { setLavoro(await api.lavoro(id)) } catch (e) { if (!e?.linea) setErrore(e.message) }
  }, [id])

  useEffect(() => { ricarica() }, [ricarica])
  useEffect(() => ascoltaCoda(setCoda), [])

  // Una foto caricata da un collega arriva qui e compare senza fare niente.
  useEffect(() => {
    if (!segnale || segnale.lavoro_id !== id) return
    if (segnale.tipo === 'foto_aggiunta' && segnale.utente_id !== utente.id) {
      setNuove((s) => new Set(s).add(segnale.payload.id))
    }
    ricarica()
  }, [segnale, id, utente.id, ricarica])

  async function mandaFoto (file) {
    const scelti = Array.from(file || [])
    if (!scelti.length) return
    setErrore('')
    setInvio({ fatte: 0, totali: scelti.length })

    for (let i = 0; i < scelti.length; i++) {
      try {
        // Senza campo la foto non si perde: resta sul telefono e parte dopo.
        await mandaFotoOAccoda(id, scelti[i])
      } catch (e) {
        setErrore(`${e.message} (foto ${i + 1} di ${scelti.length})`)
        break
      }
      setInvio({ fatte: i + 1, totali: scelti.length })
    }

    setInvio(null)
    ricarica()
  }

  async function mandaDocumento (file) {
    const scelti = Array.from(file || [])
    if (!scelti.length) return
    try {
      for (const f of scelti) await caricaDocumento(id, f)
      ricarica()
    } catch (e) { segnala(e) }
  }

  // Lo stato si cambia con un tocco e si vede subito: la conferma dal
  // server arriva un attimo dopo.
  async function impostaStato (stato) {
    if (stato === lavoro.stato) return
    setLavoro((l) => ({ ...l, stato }))
    try {
      await api.aggiornaLavoro(id, { stato })
    } catch (e) { segnala(e) }
    ricarica()
  }

  // L'elenco della squadra serve solo quando si apre la scelta.
  useEffect(() => {
    if (scegliChi && colleghi.length === 0) api.colleghi().then(setColleghi).catch(() => {})
  }, [scegliChi, colleghi.length])

  async function programma (dataLavoro, oraLavoro) {
    setLavoro((l) => ({ ...l, data_lavoro: dataLavoro, ora_lavoro: oraLavoro }))
    try {
      await api.programmaLavoro(id, { data_lavoro: dataLavoro, ora_lavoro: oraLavoro })
    } catch (e) { segnala(e) }
    ricarica()
  }

  async function cambiaChiCiVa (persona, dentro) {
    try {
      if (dentro) await api.mettiInSquadra(id, persona.id)
      else await api.togliDaSquadra(id, persona.id)
      await ricarica()
    } catch (e) { segnala(e) }
  }

  async function eliminaDocumento (doc) {
    if (!confirm(`Elimino “${doc.nome_file}”?`)) return
    try {
      await api.eliminaDocumento(doc.id)
      ricarica()
    } catch (e) { segnala(e) }
  }

  async function aggiungiNota (e) {
    e.preventDefault()
    const testo = nota.trim()
    if (!testo || salvoNota) return
    setSalvoNota(true)
    try {
      await api.creaAnnotazione(id, testo)
      setNota('')
      await ricarica()
    } catch (err) { segnala(err) } finally { setSalvoNota(false) }
  }

  async function segnaNota (a) {
    setLavoro((l) => ({
      ...l,
      annotazioni: l.annotazioni.map((x) => (x.id === a.id ? { ...x, fatta: !a.fatta } : x))
    }))
    try {
      await api.segnaAnnotazione(a.id, !a.fatta)
    } catch (e) { segnala(e) }
    ricarica()
  }

  async function eliminaNota (a) {
    if (!confirm('Elimino questa annotazione?')) return
    try {
      await api.eliminaAnnotazione(a.id)
      ricarica()
    } catch (e) { segnala(e) }
  }

  // Chi ha seguito il progetto in azienda: si scrive e si salva uscendo
  // dal campo, senza bottoni.
  async function salvaReferente (campo, valore) {
    if ((lavoro[campo] || '') === valore.trim()) return
    try {
      await api.aggiornaLavoro(id, { [campo]: valore.trim() })
      await ricarica()
    } catch (e) { segnala(e) }
  }

  async function eliminaFirma (firma) {
    if (!confirm('Elimino la firma?')) return
    try {
      await api.eliminaFirma(firma.id)
      ricarica()
    } catch (e) { segnala(e) }
  }

  async function creaLink () {
    try {
      await api.creaCondivisione(id)
      await ricarica()
    } catch (e) { segnala(e) }
  }

  async function annullaLink (condivisione) {
    if (!confirm('Annullo il link? Chi ce l\'ha non vedra\' piu\' niente.')) return
    try {
      await api.eliminaCondivisione(condivisione.id)
      ricarica()
    } catch (e) { segnala(e) }
  }

  async function condividiLink (indirizzo) {
    try {
      if (navigator.share) {
        await navigator.share({ title: lavoro.titolo, url: indirizzo })
        return
      }
      await navigator.clipboard.writeText(indirizzo)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2200)
    } catch { /* l'utente ha annullato la condivisione */ }
  }

  async function eliminaLavoro () {
    if (!confirm('Elimino il lavoro con tutte le sue foto? Non si torna indietro.')) return
    await api.eliminaLavoro(id)
    indietro()
  }

  if (!lavoro) {
    return (
      <>
        <header className="testata">
          <button className="indietro" onClick={indietro} aria-label="Indietro">‹</button>
          <h1>Lavoro</h1>
        </header>
        <div className="contenuto">
          {errore ? <div className="errore">{errore}</div> : <div className="vuoto">Carico…</div>}
        </div>
      </>
    )
  }

  const cliente = nomeCliente(lavoro)
  const note = lavoro.annotazioni || []
  const daFare = note.filter((a) => !a.fatta).length
  const squadra = lavoro.assegnati || []
  const inSquadra = new Set(squadra.map((p) => p.id))
  const firme = lavoro.firme || []
  const inAttesaQui = coda.per[id] || 0
  const link = (lavoro.condivisioni || [])[0]

  return (
    <>
      <header className="testata">
        <button className="indietro" onClick={indietro} aria-label="Indietro">‹</button>
        <h1>
          {lavoro.titolo}
          {lavoro.azienda_nome && <span className="sotto">{lavoro.azienda_nome}</span>}
        </h1>
        <button className="azione-testata" onClick={() => setMenu(true)} aria-label="Opzioni">⋯</button>
      </header>

      <div className="contenuto">
        {errore && <div className="errore">{errore}</div>}

        <div className="carta">
          <div className="stato-scelta" role="group" aria-label="Stato del lavoro">
            <button aria-pressed={lavoro.stato === 'in_corso'} onClick={() => impostaStato('in_corso')}>
              In corso
            </button>
            <button aria-pressed={lavoro.stato === 'concluso'} onClick={() => impostaStato('concluso')}>
              Concluso
            </button>
          </div>

          <div className="riga-etichette">
            {lavoro.foto.length > 0 && <span className="etichetta">{lavoro.foto.length} 📷</span>}
            {lavoro.documenti.length > 0 && <span className="etichetta">{lavoro.documenti.length} 📄</span>}
            {daFare > 0 && <span className="etichetta attenzione">{daFare} da fare</span>}
          </div>

          {cliente && <div style={{ fontWeight: 600, marginBottom: 4 }}>{cliente}</div>}

          {lavoro.indirizzo && (
            <a href={linkMappe(lavoro.indirizzo)} target="_blank" rel="noreferrer"
              style={{ display: 'block', color: 'var(--scuro-2)', marginBottom: 10 }}>
              📍 {lavoro.indirizzo}
            </a>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {lavoro.cliente_telefono && (
              <a className="bottone chiaro piccolo" style={{ flex: 1 }} href={`tel:${lavoro.cliente_telefono}`}>
                📞 Chiama
              </a>
            )}
            {lavoro.indirizzo && (
              <a className="bottone chiaro piccolo" style={{ flex: 1 }} href={linkMappe(lavoro.indirizzo)} target="_blank" rel="noreferrer">
                🧭 Naviga
              </a>
            )}
          </div>

          {lavoro.note && (
            <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap', color: 'var(--testo-tenue)', fontSize: 14.5 }}>
              {lavoro.note}
            </p>
          )}
        </div>

        <div className="carta">
          <div className="campo">
            <label htmlFor="referente">
              Chi ha fatto il progetto{lavoro.azienda_nome ? ` da ${lavoro.azienda_nome}` : ''}
            </label>
            <input
              id="referente" placeholder="Nome della persona"
              value={referente ? referente.referente : (lavoro.referente || '')}
              onChange={(e) => setReferente({
                referente: e.target.value,
                referente_telefono: referente ? referente.referente_telefono : (lavoro.referente_telefono || '')
              })}
              onBlur={(e) => salvaReferente('referente', e.target.value)}
            />
          </div>

          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor="tel-referente">Suo telefono</label>
            <div className="due">
              <input
                id="tel-referente" type="tel" inputMode="tel" placeholder="Facoltativo"
                value={referente ? referente.referente_telefono : (lavoro.referente_telefono || '')}
                onChange={(e) => setReferente({
                  referente: referente ? referente.referente : (lavoro.referente || ''),
                  referente_telefono: e.target.value
                })}
                onBlur={(e) => salvaReferente('referente_telefono', e.target.value)}
              />
              {lavoro.referente_telefono && (
                <a className="bottone chiaro piccolo" href={`tel:${lavoro.referente_telefono}`}>📞 Chiama</a>
              )}
            </div>
          </div>
        </div>

        <div className="carta">
          <div className="quando-chi">
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="giorno">Giorno del montaggio</label>
              <input id="giorno" type="date" value={lavoro.data_lavoro || ''}
                onChange={(e) => programma(e.target.value || null, e.target.value ? lavoro.ora_lavoro : null)} />
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="orario">Ora</label>
              <input id="orario" type="time" value={lavoro.ora_lavoro || ''} disabled={!lavoro.data_lavoro}
                onChange={(e) => programma(lavoro.data_lavoro, e.target.value || null)} />
            </div>
          </div>

          {lavoro.data_lavoro && (
            <button className="tolgo-data" onClick={() => programma(null, null)}>Togli dall'agenda</button>
          )}

          <label className="titolo-campo">Chi ci va</label>
          <div className="chi-ci-va">
            {squadra.map((p) => (
              <button key={p.id} className="pillola" onClick={() => cambiaChiCiVa(p, false)}
                aria-label={`Togli ${p.nome}`}>
                {p.nome} <span aria-hidden="true">✕</span>
              </button>
            ))}
            <button className="pillola aggiungi" onClick={() => setScegliChi(true)}>
              + Chi ci va
            </button>
          </div>
        </div>

        {invio && (
          <div className="carta">
            <strong style={{ fontSize: 14.5 }}>Sto caricando {invio.fatte + 1} di {invio.totali}…</strong>
            <div className="avanzamento"><div style={{ width: `${(invio.fatte / invio.totali) * 100}%` }} /></div>
            <small style={{ color: 'var(--testo-tenue)' }}>Puoi restare su questa schermata.</small>
          </div>
        )}

        {inAttesaQui > 0 && (
          <div className="carta in-attesa">
            <strong>{inAttesaQui} {inAttesaQui === 1 ? 'foto in attesa' : 'foto in attesa'} di campo</strong>
            <p>
              Restano su questo telefono e partono da sole appena torna la linea.
              Puoi chiudere l'app.
            </p>
            {coda.errore && <small>Ultimo tentativo: {coda.errore}</small>}
            <button className="bottone chiaro piccolo" onClick={() => svuotaCoda()} disabled={coda.sto}>
              {coda.sto ? 'Sto provando…' : 'Prova adesso'}
            </button>
          </div>
        )}

        <h2 className="titolo-sezione">Foto</h2>

        {lavoro.foto.length === 0
          ? <p className="riga-vuota">Ancora nessuna foto. Scattane una con i bottoni qui sotto.</p>
          : (
            <div className="griglia-foto">
              {lavoro.foto.map((f, posto) => (
                <button key={f.id} className={nuove.has(f.id) ? 'nuova' : ''} onClick={() => setAperta(posto)}>
                  <img src={f.url_mini} alt={f.didascalia || ''} loading="lazy" />
                </button>
              ))}
            </div>
            )}

        <h2 className="titolo-sezione">Documenti</h2>

        {lavoro.documenti.length === 0 && <p className="riga-vuota">Nessun documento allegato.</p>}

        {lavoro.documenti.map((d) => (
          <div className="carta" key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.nome_file}
              </div>
              <small style={{ color: 'var(--testo-tenue)' }}>
                {peso(d.byte)} · {d.caricato_da_nome} · {quando(d.caricato_il)}
              </small>
            </div>
            <a className="bottone chiaro piccolo" href={d.url} target="_blank" rel="noreferrer">Apri</a>
            {(utente.ruolo === 'admin' || d.caricato_da === utente.id) && (
              <button className="togli" onClick={() => eliminaDocumento(d)} aria-label={`Elimina ${d.nome_file}`}>✕</button>
            )}
          </div>
        ))}

        <button className="bottone chiaro" onClick={() => inputDoc.current.click()}>
          📄 Aggiungi un documento
        </button>

        <h2 className="titolo-sezione">Annotazioni</h2>

        <div className="carta">
          <form className="nuova-nota" onSubmit={aggiungiNota}>
            <input
              value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000}
              placeholder="Manca una maniglia, da ordinare…"
            />
            <button className="bottone arancio piccolo" type="submit" disabled={!nota.trim() || salvoNota}>
              Aggiungi
            </button>
          </form>

          {note.length === 0
            ? <p className="riga-vuota" style={{ margin: '14px 0 2px' }}>
                Qui segni quello che manca o che va ordinato dopo. Lo vedono tutti.
              </p>
            : (
              <ul className="note">
                {note.map((a) => (
                  <li key={a.id} className={a.fatta ? 'fatta' : ''}>
                    <button className="spunta" onClick={() => segnaNota(a)} aria-pressed={a.fatta}
                      aria-label={a.fatta ? 'Rimetti da fare' : 'Segna come fatta'}>
                      {a.fatta ? '✓' : ''}
                    </button>
                    <div className="corpo">
                      <span>{a.testo}</span>
                      <small>
                        {a.fatta
                          ? `Fatta da ${a.chiusa_da_nome || 'qualcuno'} · ${quando(a.chiusa_il)}`
                          : `${a.creata_da_nome || 'qualcuno'} · ${quando(a.creata_il)}`}
                      </small>
                    </div>
                    <button className="togli" onClick={() => eliminaNota(a)} aria-label="Elimina annotazione">✕</button>
                  </li>
                ))}
              </ul>
              )}
        </div>

        <h2 className="titolo-sezione">Firma e consegna</h2>

        <div className="carta">
          {firme.length === 0
            ? <p className="riga-vuota" style={{ marginBottom: 12 }}>
                Nessuna firma. A fine montaggio falla mettere al cliente: resta qui e finisce
                nel resoconto per l'azienda.
              </p>
            : firme.map((f) => (
              <div key={f.id} className="firma-fatta">
                <img src={f.url} alt={`Firma di ${f.nome_cliente || 'cliente'}`} />
                <div className="sotto">
                  <div>
                    <strong>{f.nome_cliente || 'Cliente'}</strong>
                    <small>{dataEstesa(f.firmata_il)}{f.raccolta_da_nome ? ` · raccolta da ${f.raccolta_da_nome}` : ''}</small>
                    {f.nota && <small>{f.nota}</small>}
                  </div>
                  <button className="togli" onClick={() => eliminaFirma(f)} aria-label="Elimina la firma">✕</button>
                </div>
              </div>
              ))}

          <button className="bottone chiaro" onClick={() => setFaiFirmare(true)}>
            ✍️ Fai firmare il cliente
          </button>

          <label className="titolo-campo">Link per l'azienda</label>
          {link
            ? (
              <>
                <div className="link-azienda">{`${location.origin}/r/${link.token}`}</div>
                <div className="due">
                  <button className="bottone chiaro piccolo" onClick={() => condividiLink(`${location.origin}/r/${link.token}`)}>
                    {copiato ? 'Copiato' : 'Manda il link'}
                  </button>
                  <button className="bottone chiaro piccolo" onClick={() => annullaLink(link)}>Annulla il link</button>
                </div>
                <small style={{ display: 'block', marginTop: 8, color: 'var(--testo-tenue)' }}>
                  Aperto {link.aperture} {link.aperture === 1 ? 'volta' : 'volte'}. Scade il {soloData(link.scade_il)}.
                </small>
              </>
              )
            : (
              <>
                <p className="riga-vuota">
                  Un link con foto, firma e cose da sistemare, che l'azienda apre dal computer
                  senza installare niente.
                </p>
                <button className="bottone chiaro" onClick={creaLink}>🔗 Crea il link</button>
              </>
              )}
        </div>
      </div>

      <div className="barra-azione">
        <button className="bottone arancio" onClick={() => inputFotocamera.current.click()} disabled={!!invio}>
          📷 Scatta
        </button>
        <button className="bottone chiaro" onClick={() => inputFoto.current.click()} disabled={!!invio}>
          🖼 Galleria
        </button>
      </div>

      <input ref={inputFotocamera} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { mandaFoto(e.target.files); e.target.value = '' }} />
      <input ref={inputFoto} type="file" accept="image/*" multiple hidden
        onChange={(e) => { mandaFoto(e.target.files); e.target.value = '' }} />
      <input ref={inputDoc} type="file" multiple hidden
        onChange={(e) => { mandaDocumento(e.target.files); e.target.value = '' }} />

      {aperta !== null && lavoro.foto.length > 0 && (
        <Visore
          foto={lavoro.foto} indice={Math.min(aperta, lavoro.foto.length - 1)} utente={utente}
          chiudi={() => setAperta(null)}
          quandoCambia={(o) => { if (!o?.resta) setAperta(null); ricarica() }}
        />
      )}

      {faiFirmare && (
        <Firma
          lavoro={lavoro}
          chiudi={() => setFaiFirmare(false)}
          quandoSalvata={() => { setFaiFirmare(false); ricarica() }}
        />
      )}

      {scegliChi && (
        <div className="foglio-sfondo" onClick={() => setScegliChi(false)}>
          <div className="foglio" onClick={(e) => e.stopPropagation()}>
            <h2>Chi va a fare questo montaggio</h2>
            {colleghi.length === 0
              ? <p className="riga-vuota">Carico la squadra…</p>
              : colleghi.map((p) => (
                <button key={p.id} className="scelta-persona" aria-pressed={inSquadra.has(p.id)}
                  onClick={() => cambiaChiCiVa(p, !inSquadra.has(p.id))}>
                  <span className="cerchio">{iniziali(p.nome)}</span>
                  <span className="nome">{p.nome}{p.id === utente.id ? ' (tu)' : ''}</span>
                  <span className="segno">{inSquadra.has(p.id) ? '✓' : ''}</span>
                </button>
                ))}
            <button className="bottone chiaro" style={{ marginTop: 12 }} onClick={() => setScegliChi(false)}>
              Fatto
            </button>
          </div>
        </div>
      )}

      {menu && (
        <div className="foglio-sfondo" onClick={() => setMenu(false)}>
          <div className="foglio" onClick={(e) => e.stopPropagation()}>
            <h2>{lavoro.titolo}</h2>
            <p style={{ fontSize: 13, color: 'var(--testo-tenue)', marginTop: 0 }}>
              Creato da {lavoro.creato_da_nome || 'qualcuno'} il {dataEstesa(lavoro.creato_il)}
            </p>
            {utente.ruolo === 'admin' && (
              <button className="bottone pericolo" onClick={eliminaLavoro}>Elimina il lavoro</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
