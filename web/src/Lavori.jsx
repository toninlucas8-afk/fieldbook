import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { nomeCliente, quando } from './utili.js'

export default function Lavori ({ utente, apriLavoro, apriNuovo, apriSquadra, esci, segnale }) {
  const [filtro, setFiltro] = useState('in_corso')
  const [cerca, setCerca] = useState('')
  const [lavori, setLavori] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState('')
  const [menu, setMenu] = useState(false)
  const [senzaCopertina, setSenzaCopertina] = useState(() => new Set())

  useEffect(() => {
    let vivo = true
    const t = setTimeout(async () => {
      try {
        const dati = await api.lavori({ stato: filtro === 'tutti' ? null : filtro, q: cerca })
        if (vivo) { setLavori(dati); setErrore('') }
      } catch (e) {
        if (vivo) setErrore(e.message)
      } finally {
        if (vivo) setCaricando(false)
      }
    }, cerca ? 280 : 0)
    return () => { vivo = false; clearTimeout(t) }
  }, [filtro, cerca, segnale])

  const titoloFiltro = useMemo(
    () => ({ in_corso: 'in corso', concluso: 'conclusi', tutti: 'in archivio' }[filtro]),
    [filtro]
  )

  return (
    <>
      <header className="testata">
        <h1>
          Lavori
          <span className="sotto">Ciao {utente.nome.split(' ')[0]}</span>
        </h1>
        {utente.ruolo === 'admin' && (
          <button className="azione-testata" onClick={apriSquadra}>Squadra</button>
        )}
        <button className="azione-testata" onClick={() => setMenu(true)} aria-label="Altro">⋯</button>
      </header>

      <div className="contenuto">
        <div className="cerca">
          <input
            value={cerca} onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per cliente, indirizzo, azienda…" type="search"
          />
        </div>

        <div className="filtri">
          <button aria-pressed={filtro === 'in_corso'} onClick={() => setFiltro('in_corso')}>In corso</button>
          <button aria-pressed={filtro === 'concluso'} onClick={() => setFiltro('concluso')}>Conclusi</button>
          <button aria-pressed={filtro === 'tutti'} onClick={() => setFiltro('tutti')}>Tutti</button>
        </div>

        {errore && <div className="errore">{errore}</div>}

        {caricando
          ? <div className="vuoto">Carico i lavori…</div>
          : lavori.length === 0
            ? (
              <div className="vuoto">
                {cerca ? <>Nessun lavoro trovato per “{cerca}”.</> : <>Nessun lavoro {titoloFiltro}.</>}
              </div>
              )
            : lavori.map((l) => (
              <button key={l.id} className="carta lavoro-riga" onClick={() => apriLavoro(l.id)}>
                {l.copertina_url && !senzaCopertina.has(l.id)
                  ? <img
                      className="copertina" src={l.copertina_url} alt="" loading="lazy"
                      onError={() => setSenzaCopertina((s) => new Set(s).add(l.id))}
                    />
                  : <div className="copertina">📷</div>}

                <div className="corpo">
                  <h3>{l.titolo}</h3>
                  {nomeCliente(l) && <p>{nomeCliente(l)}</p>}
                  {l.indirizzo && <p>{l.indirizzo}</p>}

                  <div className="fondo">
                    {l.azienda_nome && (
                      <span className="etichetta">
                        <i className="pallino-azienda" style={l.azienda_colore ? { background: l.azienda_colore } : undefined} />
                        {l.azienda_nome}
                      </span>
                    )}
                    <span className={`etichetta ${l.stato === 'in_corso' ? 'in-corso' : 'concluso'}`}>
                      {l.stato === 'in_corso' ? 'In corso' : 'Concluso'}
                    </span>
                    <span className="etichetta">{l.foto_totali} 📷</span>
                    {l.documenti_totali > 0 && <span className="etichetta">{l.documenti_totali} 📄</span>}
                    {l.annotazioni_aperte > 0 && (
                      <span className="etichetta attenzione">{l.annotazioni_aperte} da fare</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--testo-tenue)' }}>
                      {quando(l.aggiornato_il)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
      </div>

      <div className="barra-azione">
        <button className="bottone arancio" onClick={apriNuovo}>+ Nuovo lavoro</button>
      </div>

      {menu && (
        <div className="foglio-sfondo" onClick={() => setMenu(false)}>
          <div className="foglio" onClick={(e) => e.stopPropagation()}>
            <h2>{utente.nome}</h2>
            <button className="bottone chiaro" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); apriSquadra('mio-pin') }}>
              Cambia il mio PIN
            </button>
            <button className="bottone pericolo" onClick={esci}>Esci da questo telefono</button>
          </div>
        </div>
      )}
    </>
  )
}
