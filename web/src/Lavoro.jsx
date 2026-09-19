import { useCallback, useEffect, useRef, useState } from 'react'
import { api, caricaDocumento, caricaFoto } from './api.js'
import { dataEstesa, linkMappe, nomeCliente, peso, quando } from './utili.js'

export default function Lavoro ({ id, utente, indietro, segnale }) {
  const [lavoro, setLavoro] = useState(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(null)      // { fatte, totali }
  const [aperta, setAperta] = useState(null)    // foto nel visore
  const [menu, setMenu] = useState(false)
  const [nuove, setNuove] = useState(() => new Set())

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

  async function cambiaStato () {
    const stato = lavoro.stato === 'in_corso' ? 'concluso' : 'in_corso'
    setLavoro(await api.aggiornaLavoro(id, { stato }))
    setMenu(false)
    ricarica()
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: cliente || lavoro.indirizzo ? 12 : 0 }}>
            <span className={`etichetta ${lavoro.stato === 'in_corso' ? 'in-corso' : 'concluso'}`}>
              {lavoro.stato === 'in_corso' ? 'In corso' : 'Concluso'}
            </span>
            <span className="etichetta">{lavoro.foto_totali} foto</span>
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

        {invio && (
          <div className="carta">
            <strong style={{ fontSize: 14.5 }}>Sto caricando {invio.fatte + 1} di {invio.totali}…</strong>
            <div className="avanzamento"><div style={{ width: `${(invio.fatte / invio.totali) * 100}%` }} /></div>
            <small style={{ color: 'var(--testo-tenue)' }}>Puoi restare su questa schermata.</small>
          </div>
        )}

        <h2 style={{ fontSize: 16, margin: '18px 0 10px' }}>Foto</h2>

        {lavoro.foto.length === 0
          ? <div className="vuoto">Ancora nessuna foto. Scattane una qui sotto.</div>
          : (
            <div className="griglia-foto">
              {lavoro.foto.map((f) => (
                <button key={f.id} className={nuove.has(f.id) ? 'nuova' : ''} onClick={() => setAperta(f)}>
                  <img src={f.url_mini} alt={f.didascalia || ''} loading="lazy" />
                </button>
              ))}
            </div>
            )}

        {lavoro.documenti.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, margin: '22px 0 10px' }}>Documenti</h2>
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
              </div>
            ))}
          </>
        )}

        <button className="bottone chiaro" style={{ marginTop: 16 }} onClick={() => inputDoc.current.click()}>
          📄 Aggiungi un documento
        </button>
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

      {menu && (
        <div className="foglio-sfondo" onClick={() => setMenu(false)}>
          <div className="foglio" onClick={(e) => e.stopPropagation()}>
            <h2>{lavoro.titolo}</h2>
            <button className="bottone chiaro" style={{ marginBottom: 10 }} onClick={cambiaStato}>
              {lavoro.stato === 'in_corso' ? '✓ Segna come concluso' : '↩ Rimetti in corso'}
            </button>
            <p style={{ fontSize: 13, color: 'var(--testo-tenue)' }}>
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
