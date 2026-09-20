import { useEffect, useState } from 'react'
import { api, ascoltaEventi } from './api.js'
import { aggiornaConto, svuotaCoda } from './coda.js'
import Accesso from './Accesso.jsx'
import Lavori from './Lavori.jsx'
import Lavoro from './Lavoro.jsx'
import NuovoLavoro from './NuovoLavoro.jsx'
import Squadra from './Squadra.jsx'

export default function App () {
  const [utente, setUtente] = useState(null)
  const [controllato, setControllato] = useState(false)
  // Toccando un avviso il telefono apre /?lavoro=<id>: si va dritti li'.
  const [schermata, setSchermata] = useState(() => {
    const id = new URLSearchParams(location.search).get('lavoro')
    return id ? { nome: 'lavoro', id } : { nome: 'lavori' }
  })
  const [segnale, setSegnale] = useState(null)

  // Ripulisce l'indirizzo dopo essere arrivati da un avviso, cosi' un
  // aggiornamento della pagina non riapre sempre lo stesso lavoro.
  useEffect(() => {
    if (location.search) history.replaceState({}, '', location.pathname)
  }, [])

  // Il telefono resta riconosciuto: si riparte da dov'eravamo.
  useEffect(() => {
    api.io()
      .then(({ utente }) => setUtente(utente))
      .catch(() => setUtente(null))
      .finally(() => setControllato(true))
  }, [])

  // Connessione sempre aperta: le foto dei colleghi compaiono da sole.
  useEffect(() => {
    if (!utente) return
    return ascoltaEventi(setSegnale)
  }, [utente])

  // Le foto scattate senza campo partono da sole: appena si rientra,
  // quando torna la linea, e ogni tanto mentre l'app e' aperta.
  useEffect(() => {
    if (!utente) return
    aggiornaConto().then(() => svuotaCoda())
    const quandoTorna = () => svuotaCoda()
    window.addEventListener('online', quandoTorna)
    const ogniTanto = setInterval(() => svuotaCoda(), 60_000)
    return () => {
      window.removeEventListener('online', quandoTorna)
      clearInterval(ogniTanto)
    }
  }, [utente])

  // Il tasto "indietro" del telefono chiude la schermata, non l'app.
  useEffect(() => {
    const torna = () => setSchermata({ nome: 'lavori' })
    if (schermata.nome !== 'lavori') {
      history.pushState({ fb: true }, '')
      window.addEventListener('popstate', torna)
      return () => window.removeEventListener('popstate', torna)
    }
  }, [schermata.nome])

  const vaiA = (nome, extra = {}) => setSchermata({ nome, ...extra })
  const aiLavori = () => setSchermata({ nome: 'lavori' })

  async function esci () {
    await api.esci().catch(() => {})
    setUtente(null)
    aiLavori()
  }

  if (!controllato) return <div className="vuoto" style={{ paddingTop: '38vh' }}>Apro Fieldbook…</div>
  if (!utente) return <Accesso quandoEntra={(u) => { setUtente(u); aiLavori() }} />

  switch (schermata.nome) {
    case 'lavoro':
      return <Lavoro id={schermata.id} utente={utente} indietro={aiLavori} segnale={segnale} />

    case 'nuovo':
      return (
        <NuovoLavoro
          utente={utente} indietro={aiLavori}
          quandoCreato={(id) => vaiA('lavoro', { id })}
        />
      )

    case 'squadra':
      return <Squadra utente={utente} indietro={aiLavori} apriSubitoMioPin={schermata.mioPin} />

    default:
      return (
        <Lavori
          utente={utente} segnale={segnale} esci={esci}
          apriLavoro={(id) => vaiA('lavoro', { id })}
          apriNuovo={() => vaiA('nuovo')}
          apriSquadra={(modo) => vaiA('squadra', { mioPin: modo === 'mio-pin' })}
        />
      )
  }
}
