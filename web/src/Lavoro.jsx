import { useCallback, useEffect, useRef, useState } from 'react'
import { api, caricaDocumento, caricaFoto } from './api.js'
import { dataEstesa, iniziali, linkMappe, nomeCliente, peso, quando } from './utili.js'

export default function Lavoro ({ id, utente, indietro, segnale }) {
  const [lavoro, setLavoro] = useState(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(null)      // { fatte, totali }
  const [aperta, setAperta] = useState(null)    // foto nel visore
  const [menu, setMenu] = useState(false)
  const [nuove, setNuove] = useState(() => new Set())
  const [nota, setNota] = useState('')
  const [salvoNota, setSalvoNota] = useState(false)
  const [scegliChi, setScegliChi] = useState(false)
  const [colleghi, setColleghi] = useState([])

  const inputFoto = useRef(null)
  const inputFotocamera = useRef(null)
  const inputDoc = useRef(null)

  const ricarica = useCallback(async () => {
    try { setLavoro(await api.lavoro(id)) } catch (e) { setErrore(e.message) }
  }, [id])

  useEffect(() => { ricarica() }, [ricarica])

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
        await caricaFoto(id, scelti[i])
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
    } catch (e) { setErrore(e.message) }
  }

  // Lo stato si cambia con un tocco e si vede subito: la conferma dal
  // server arriva un attimo dopo.
  async function impostaStato (stato) {
    if (stato === lavoro.stato) return
    setLavoro((l) => ({ ...l, stato }))
    try {
      await api.aggiornaLavoro(id, { stato })
    } catch (e) { setErrore(e.message) }
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
    } catch (e) { setErrore(e.message) }
    ricarica()
  }

  async function cambiaChiCiVa (persona, dentro) {
    try {
      if (dentro) await api.mettiInSquadra(id, persona.id)
      else await api.togliDaSquadra(id, persona.id)
      await ricarica()
    } catch (e) { setErrore(e.message) }
  }

  async function eliminaDocumento (doc) {
    if (!confirm(`Elimino “${doc.nome_file}”?`)) return
    try {
      await api.eliminaDocumento(doc.id)
      ricarica()
    } catch (e) { setErrore(e.message) }
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
    } catch (err) { setErrore(err.message) } finally { setSalvoNota(false) }
  }

  async function segnaNota (a) {
    setLavoro((l) => ({
      ...l,
      annotazioni: l.annotazioni.map((x) => (x.id === a.id ? { ...x, fatta: !a.fatta } : x))
    }))
    try {
      await api.segnaAnnotazione(a.id, !a.fatta)
    } catch (e) { setErrore(e.message) }
    ricarica()
  }

  async function eliminaNota (a) {
    if (!confirm('Elimino questa annotazione?')) return
    try {
      await api.eliminaAnnotazione(a.id)
      ricarica()
    } catch (e) { setErrore(e.message) }
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

        <h2 className="titolo-sezione">Foto</h2>

        {lavoro.foto.length === 0
          ? <p className="riga-vuota">Ancora nessuna foto. Scattane una con i bottoni qui sotto.</p>
          : (
            <div className="griglia-foto">
              {lavoro.foto.map((f) => (
                <button key={f.id} className={nuove.has(f.id) ? 'nuova' : ''} onClick={() => setAperta(f)}>
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

      {aperta && (
        <Visore
          foto={aperta} utente={utente}
          chiudi={() => setAperta(null)}
          quandoCambia={() => { setAperta(null); ricarica() }}
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

function Visore ({ foto, utente, chiudi, quandoCambia }) {
  const [didascalia, setDidascalia] = useState(foto.didascalia || '')
  const [salvata, setSalvata] = useState(false)
  const puoEliminare = utente.ruolo === 'admin' || foto.caricata_da === utente.id

  async function salva () {
    await api.didascaliaFoto(foto.id, didascalia)
    setSalvata(true)
    setTimeout(() => setSalvata(false), 1600)
  }

  async function elimina () {
    if (!confirm('Elimino questa foto?')) return
    await api.eliminaFoto(foto.id)
    quandoCambia()
  }

  return (
    <div className="visore">
      <div className="barra">
        <button className="indietro" onClick={chiudi} aria-label="Chiudi">✕</button>
        <span className="spazio" />
        <a className="azione-testata" href={foto.url} target="_blank" rel="noreferrer" download>Scarica</a>
        {puoEliminare && <button className="azione-testata" onClick={elimina}>Elimina</button>}
      </div>

      <img src={foto.url} alt={foto.didascalia || ''} />

      <div className="piede">
        <div>Caricata da {foto.caricata_da_nome || 'qualcuno'} · {quando(foto.caricata_il)} · {peso(foto.byte)}</div>
        <input
          value={didascalia} onChange={(e) => setDidascalia(e.target.value)}
          onBlur={salva} placeholder="Aggiungi una didascalia…"
        />
        {salvata && <small style={{ color: 'var(--arancio)' }}>Didascalia salvata</small>}
      </div>
    </div>
  )
}
