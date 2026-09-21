import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import Barra from './Barra.jsx'
import ScegliRiquadri from './Riquadri.jsx'
import Snake from './Snake.jsx'
import { ascoltaCoda, svuotaCoda } from './coda.js'
import { giornoISO, nomeCliente, quandoLavoro } from './utili.js'

const PARTENZA = ['oggi', 'ritardo', 'numeri', 'prossimi', 'note', 'foto']

// La schermata di apertura: un colpo d'occhio sulla giornata, non tutto
// l'elenco dei lavori in faccia appena si entra. I riquadri li sceglie chi
// usa l'app, dal menu dei tre puntini.
export default function Home ({ utente, segnale, apriLavoro, apriNuovo, apriNote, apriLavori, apriMenu, apriGioco, vaiA }) {
  const [r, setR] = useState(null)
  const [errore, setErrore] = useState('')
  const [coda, setCoda] = useState({ totali: 0 })
  const [rotte, setRotte] = useState(() => new Set())   // miniature che non si aprono
  const [scegli, setScegli] = useState(false)
  const [riquadri, setRiquadri] = useState(PARTENZA)
  const [snake, setSnake] = useState(false)
  const [trovato, setTrovato] = useState('')
  const [tocchi, setTocchi] = useState(0)

  const ricarica = useCallback(async () => {
    try {
      const dati = await api.riassunto(giornoISO())
      setR(dati)
      setRiquadri(dati.riquadri?.length ? dati.riquadri : PARTENZA)
      setSnake(dati.snake)
      setErrore('')
    } catch (e) { if (!e?.linea) setErrore(e.message) }
  }, [])

  useEffect(() => { ricarica() }, [ricarica, segnale])
  useEffect(() => ascoltaCoda(setCoda), [])

  async function salvaRiquadri (nuovi) {
    setRiquadri(nuovi)
    try { await api.salvaPreferenze({ riquadri: nuovi }) } catch (e) { if (!e?.linea) setErrore(e.message) }
  }

  // Toccando cinque volte il saluto salta fuori il gioco. Non lo sa
  // nessuno: e' proprio il punto.
  async function tocca () {
    if (snake) return apriGioco()
    const quanti = tocchi + 1
    setTocchi(quanti)
    if (quanti < 5) return
    setTocchi(0)
    setSnake(true)
    setTrovato('Hai trovato Snake. Ora è fra i riquadri di casa.')
    setTimeout(() => setTrovato(''), 6000)
    const nuovi = [...riquadri, 'snake']
    setRiquadri(nuovi)
    try { await api.salvaPreferenze({ riquadri: nuovi, snake: true }) } catch { /* si riprova dopo */ }
  }

  const nome = utente.nome.split(' ')[0]
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  const pezzo = (id) => {
    if (!r) return null
    switch (id) {
      case 'oggi':
        return <Oggi lavori={r.oggi} apriLavoro={apriLavoro} apriNuovo={apriNuovo} />

      case 'ritardo':
        return r.in_ritardo > 0
          ? (
            <button className="avviso in-ritardo" onClick={() => apriLavori('da_fare')}>
              {r.in_ritardo === 1
                ? '1 lavoro è rimasto indietro: era in programma e non è ancora chiuso.'
                : `${r.in_ritardo} lavori sono rimasti indietro: erano in programma e non sono ancora chiusi.`}
            </button>
            )
          : null

      case 'numeri':
        return (
          <div className="numeri">
            <button className="riquadro" onClick={() => apriLavori('da_fare')}>
              <span className="segno" aria-hidden="true">🧰</span>
              <strong>{r.in_corso}</strong>
              <span>lavori in corso</span>
            </button>
            <button className="riquadro" onClick={() => apriLavori('miei')}>
              <span className="segno" aria-hidden="true">🙋</span>
              <strong>{r.miei}</strong>
              <span>dove ci sei tu</span>
            </button>
            <button className={`riquadro ${r.da_fare > 0 ? 'attenzione' : ''}`}
              onClick={() => apriLavori('da_fare')}>
              <span className="segno" aria-hidden="true">🔧</span>
              <strong>{r.da_fare}</strong>
              <span>cose da sistemare</span>
            </button>
          </div>
        )

      case 'prossimi':
        return r.prossimi.length > 0
          ? (
            <>
              <h2 className="titolo-sezione">Prossimi giorni</h2>
              <div className="carta elenco-prossimi">
                {r.prossimi.map((l) => (
                  <button key={l.id} onClick={() => apriLavoro(l.id)}>
                    <span className="giorno-corto">{quandoLavoro(l)}</span>
                    <span className="titolo">{l.titolo}</span>
                    {l.indirizzo && <small>{l.indirizzo}</small>}
                  </button>
                ))}
              </div>
            </>
            )
          : null

      case 'note':
        return (
          <>
            <h2 className="titolo-sezione">Il tuo blocco note</h2>
            <button className="carta note-sintesi" onClick={apriNote}>
              {r.note.quante === 0
                ? <span className="riga-vuota">Niente segnato. Tocca per scrivere una cosa da ricordare.</span>
                : (
                  <>
                    <ul>{r.note.prime.map((n) => <li key={n.id}>{n.testo}</li>)}</ul>
                    {r.note.quante > r.note.prime.length && (
                      <small>e altre {r.note.quante - r.note.prime.length}</small>
                    )}
                  </>
                  )}
            </button>
          </>
        )

      case 'foto':
        return r.ultime_foto.some((f) => !rotte.has(f.id))
          ? (
            <>
              <h2 className="titolo-sezione">Ultime foto</h2>
              <div className="striscia-foto">
                {r.ultime_foto.filter((f) => !rotte.has(f.id)).map((f) => (
                  <button key={f.id} onClick={() => apriLavoro(f.lavoro_id)}
                    aria-label={`Apri ${f.lavoro_titolo}`}>
                    <img
                      src={f.url_mini} alt="" loading="lazy"
                      onError={() => setRotte((x) => new Set(x).add(f.id))}
                    />
                  </button>
                ))}
              </div>
            </>
            )
          : null

      case 'snake':
        return <Snake />

      default:
        return null
    }
  }

  return (
    <>
      <header className="testata">
        <h1 onClick={tocca}>
          Ciao {nome}
          <span className="sotto">{oggi.charAt(0).toUpperCase() + oggi.slice(1)}</span>
        </h1>
        <button className="azione-testata" onClick={() => setScegli(true)} aria-label="Scegli i riquadri">▦</button>
        <button className="azione-testata" onClick={apriMenu} aria-label="Altro">⋯</button>
      </header>

      <div className="contenuto con-barra">
        {errore && <div className="errore">{errore}</div>}
        {trovato && <div className="avviso">{trovato}</div>}

        {coda.totali > 0 && (
          <div className="avviso" onClick={() => svuotaCoda()}>
            {coda.totali} {coda.totali === 1 ? 'foto aspetta' : 'foto aspettano'} il campo per partire.
            Restano sul telefono, non si perdono.
          </div>
        )}

        {!r
          ? <div className="vuoto">Apro…</div>
          : riquadri.map((id) => <Fragment key={id}>{pezzo(id)}</Fragment>)}
      </div>

      <div className="barra-azione sopra-barra">
        <button className="bottone arancio" onClick={apriNuovo}>+ Nuovo lavoro</button>
      </div>

      <Barra dove="home" vaiA={vaiA} />

      {scegli && (
        <ScegliRiquadri
          scelti={riquadri} snake={snake}
          salva={salvaRiquadri} chiudi={() => setScegli(false)}
        />
      )}
    </>
  )
}

// Il riquadro grande: che cosa c'e' da fare oggi.
function Oggi ({ lavori, apriLavoro, apriNuovo }) {
  if (lavori.length === 0) {
    return (
      <div className="carta oggi vuota">
        <h2>Oggi</h2>
        <p>Niente in programma per oggi.</p>
        <button className="bottone chiaro piccolo" onClick={apriNuovo}>Segna un lavoro</button>
      </div>
    )
  }

  return (
    <div className="carta oggi">
      <h2>Oggi · {lavori.length} {lavori.length === 1 ? 'lavoro' : 'lavori'}</h2>

      {lavori.map((l) => (
        <button key={l.id} className="riga-oggi" onClick={() => apriLavoro(l.id)}>
          <span className="ora">{l.ora_lavoro || '—'}</span>
          <span className="corpo">
            <strong>{l.titolo}</strong>
            {nomeCliente(l) && <small>{nomeCliente(l)}</small>}
            {l.indirizzo && <small>📍 {l.indirizzo}</small>}
          </span>
          {l.annotazioni_aperte > 0 && (
            <span className="etichetta attenzione">{l.annotazioni_aperte}</span>
          )}
        </button>
      ))}
    </div>
  )
}
