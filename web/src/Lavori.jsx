import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import Barra from './Barra.jsx'
import Menu from './Menu.jsx'
import { ascoltaCoda, svuotaCoda } from './coda.js'
import { giornoISO, iniziali, nomeCliente, piuGiorni, quando, quandoLavoro, titoloGiorno } from './utili.js'

const VISTE = [
  { id: 'oggi', testo: 'Oggi' },
  { id: 'settimana', testo: 'Settimana' },
  { id: 'da_fare', testo: 'Da fare' },
  { id: 'tutti', testo: 'Tutti' }
]

export default function Lavori ({ utente, apriLavoro, apriNote, apriNuovo, apriSquadra, esci, segnale, vaiA, vistaIniziale, ricordaVista }) {
  // Arrivando da un riquadro della schermata di apertura si parte gia'
  // filtrati su quello che il riquadro contava; tornando da un lavoro si
  // ritrova il filtro che c'era.
  const partenza = typeof vistaIniziale === 'string' ? { vista: vistaIniziale } : (vistaIniziale || {})
  const [vista, setVista] = useState(partenza.vista === 'miei' ? 'da_fare' : (partenza.vista || 'oggi'))
  const [soloMiei, setSoloMiei] = useState(() => (
    partenza.miei !== undefined
      ? partenza.miei
      : partenza.vista === 'miei' || localStorage.getItem('fb-solo-miei') === '1'
  ))
  const [cerca, setCerca] = useState('')
  const [lavori, setLavori] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState('')
  const [menu, setMenu] = useState(false)
  const [senzaCopertina, setSenzaCopertina] = useState(() => new Set())
  const [coda, setCoda] = useState({ totali: 0 })

  useEffect(() => ascoltaCoda(setCoda), [])

  // Uscendo su un lavoro e tornando indietro si ritrova il filtro di prima.
  useEffect(() => { ricordaVista?.({ vista, miei: soloMiei }) }, [vista, soloMiei, ricordaVista])

  // Cercando si guarda in tutto l'archivio: filtrare per giorno darebbe
  // "non trovato" su un lavoro che invece c'e'.
  const staCercando = cerca.trim().length > 0
  const filtro = useMemo(() => {
    if (staCercando) return { q: cerca.trim() }
    const oggi = giornoISO()
    const mio = soloMiei || undefined
    if (vista === 'oggi') return { da: oggi, a: oggi, mio }
    if (vista === 'settimana') return { da: oggi, a: piuGiorni(oggi, 6), mio }
    if (vista === 'da_fare') return { stato: 'in_corso', mio }
    return { mio }
  }, [vista, cerca, soloMiei, staCercando])

  useEffect(() => {
    let vivo = true
    const t = setTimeout(async () => {
      try {
        const dati = await api.lavori(filtro)
        if (vivo) { setLavori(dati); setErrore('') }
      } catch (e) {
        if (vivo) setErrore(e.message)
      } finally {
        if (vivo) setCaricando(false)
      }
    }, staCercando ? 280 : 0)
    return () => { vivo = false; clearTimeout(t) }
  }, [filtro, segnale, staCercando])

  function cambiaMiei (valore) {
    setSoloMiei(valore)
    try { localStorage.setItem('fb-solo-miei', valore ? '1' : '0') } catch { /* modalita' anonima */ }
  }

  // In agenda i lavori si leggono raggruppati per giorno.
  const inAgenda = !staCercando && (vista === 'oggi' || vista === 'settimana')
  const gruppi = useMemo(() => {
    if (!inAgenda) return [['', lavori]]
    const per = new Map()
    for (const l of lavori) {
      const g = l.data_lavoro || ''
      if (!per.has(g)) per.set(g, [])
      per.get(g).push(l)
    }
    return [...per.entries()]
  }, [lavori, inAgenda])

  return (
    <>
      <header className="testata">
        <h1>
          Lavori
          <span className="sotto">{lavori.length === 1 ? '1 lavoro' : `${lavori.length} lavori`}</span>
        </h1>
        <button className="azione-testata" onClick={() => setMenu(true)} aria-label="Altro">⋯</button>
      </header>

      <div className="contenuto con-barra">
        <div className="cerca">
          <input
            value={cerca} onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per cliente, indirizzo, azienda…" type="search"
          />
        </div>

        <div className="filtri">
          {VISTE.map((v) => (
            <button key={v.id} aria-pressed={vista === v.id && !staCercando} onClick={() => { setCerca(''); setVista(v.id) }}>
              {v.testo}
            </button>
          ))}
          <button className="filtro-miei" aria-pressed={soloMiei} onClick={() => cambiaMiei(!soloMiei)}>
            I miei
          </button>
        </div>

        {errore && <div className="errore">{errore}</div>}

        {coda.totali > 0 && (
          <div className="avviso" onClick={() => svuotaCoda()}>
            {coda.totali} {coda.totali === 1 ? 'foto aspetta' : 'foto aspettano'} il campo per partire.
            Restano sul telefono, non si perdono.
          </div>
        )}

        {caricando
          ? <div className="vuoto">Carico i lavori…</div>
          : lavori.length === 0
            ? <Vuoto vista={vista} cerca={cerca} soloMiei={soloMiei} vaiA={setVista} />
            : gruppi.map(([giorno, righe]) => (
              <div key={giorno || 'tutti'}>
                {inAgenda && <h2 className="giorno">{titoloGiorno(giorno)}</h2>}

                {righe.map((l) => (
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
                        {!inAgenda && l.data_lavoro && (
                          <span className="etichetta quando">🗓 {quandoLavoro(l)}</span>
                        )}
                        {inAgenda && l.ora_lavoro && <span className="etichetta quando">🕗 {l.ora_lavoro}</span>}
                        {l.azienda_nome && (
                          <span className="etichetta">
                            <i className="pallino-azienda" style={l.azienda_colore ? { background: l.azienda_colore } : undefined} />
                            {l.azienda_nome}
                          </span>
                        )}
                        <span className={`etichetta ${l.stato === 'in_corso' ? 'in-corso' : 'concluso'}`}>
                          {l.stato === 'in_corso' ? 'In corso' : 'Concluso'}
                        </span>
                        {l.foto_totali > 0 && <span className="etichetta">{l.foto_totali} 📷</span>}
                        {l.documenti_totali > 0 && <span className="etichetta">{l.documenti_totali} 📄</span>}
                        {l.annotazioni_aperte > 0 && (
                          <span className="etichetta attenzione">{l.annotazioni_aperte} da fare</span>
                        )}
                        {(l.assegnati || []).length > 0
                          ? <Squadretta persone={l.assegnati} io={utente.id} />
                          : (
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--testo-tenue)' }}>
                              {quando(l.aggiornato_il)}
                            </span>
                            )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
      </div>

      <div className="barra-azione sopra-barra">
        <button className="bottone arancio" onClick={apriNuovo}>+ Nuovo lavoro</button>
      </div>

      <Barra dove="lavori" vaiA={vaiA} />

      {menu && (
        <Menu
          utente={utente} chiudi={() => setMenu(false)}
          apriNote={apriNote} apriSquadra={apriSquadra} esci={esci}
        />
      )}
    </>
  )
}

// I visi di chi va a fare il montaggio, in fondo alla riga.
function Squadretta ({ persone, io }) {
  const mostrate = persone.slice(0, 3)
  const restanti = persone.length - mostrate.length
  return (
    <span className="squadretta" title={persone.map((p) => p.nome).join(', ')}>
      {mostrate.map((p) => (
        <i key={p.id} className={p.id === io ? 'io' : ''}>{iniziali(p.nome)}</i>
      ))}
      {restanti > 0 && <i className="altri">+{restanti}</i>}
    </span>
  )
}

function Vuoto ({ vista, cerca, soloMiei, vaiA }) {
  if (cerca.trim()) return <div className="vuoto">Nessun lavoro trovato per “{cerca.trim()}”.</div>

  const solo = soloMiei ? ' assegnato a te' : ''
  if (vista === 'oggi') {
    return (
      <div className="vuoto">
        <p>Niente in programma per oggi{solo}.</p>
        <button className="bottone chiaro piccolo" onClick={() => vaiA('da_fare')}>Vedi i lavori da fare</button>
      </div>
    )
  }
  if (vista === 'settimana') {
    return (
      <div className="vuoto">
        <p>Niente in programma nei prossimi sette giorni{solo}.</p>
        <button className="bottone chiaro piccolo" onClick={() => vaiA('da_fare')}>Vedi i lavori da fare</button>
      </div>
    )
  }
  return <div className="vuoto">Nessun lavoro {vista === 'da_fare' ? 'da fare' : 'in archivio'}{solo}.</div>
}
