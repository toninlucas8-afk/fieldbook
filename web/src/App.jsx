import { useEffect, useState } from 'react'
import { api, ascoltaEventi } from './api.js'
import Accesso from './Accesso.jsx'
import Lavori from './Lavori.jsx'
import Lavoro from './Lavoro.jsx'
import NuovoLavoro from './NuovoLavoro.jsx'
import Squadra from './Squadra.jsx'

export default function App () {
  const [utente, setUtente] = useState(null)
  const [controllato, setControllato] = useState(false)
  const [schermata, setSchermata] = useState({ nome: 'lavori' })
  const [segnale, setSegnale] = useState(null)

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
