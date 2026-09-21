import { useEffect, useState } from 'react'
import { api, ascoltaEventi } from './api.js'
import { aggiornaConto, svuotaCoda } from './coda.js'
import Accesso from './Accesso.jsx'
import Home from './Home.jsx'
import Lavori from './Lavori.jsx'
import Menu from './Menu.jsx'
import Lavoro from './Lavoro.jsx'
import Note from './Note.jsx'
import NuovoLavoro from './NuovoLavoro.jsx'
import Squadra from './Squadra.jsx'

export default function App () {
  const [utente, setUtente] = useState(null)
  const [controllato, setControllato] = useState(false)
  // Toccando un avviso il telefono apre /?lavoro=<id>: si va dritti li'.
  const [schermata, setSchermata] = useState(() => {
    const id = new URLSearchParams(location.search).get('lavoro')
    return id ? { nome: 'lavoro', id } : { nome: 'home' }
  })
  const [menu, setMenu] = useState(false)
  const [vistaLavori, setVistaLavori] = useState(null)
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

  // Il tasto "indietro" del telefono riporta a casa, non chiude l'app.
  useEffect(() => {
    const torna = () => setSchermata({ nome: 'home' })
    if (schermata.nome !== 'home') {
      history.pushState({ fb: true }, '')
      window.addEventListener('popstate', torna)
      return () => window.removeEventListener('popstate', torna)
    }
  }, [schermata.nome])

  const vaiA = (nome, extra = {}) => setSchermata({ nome, ...extra })
  const aCasa = () => setSchermata({ nome: 'home' })

  async function esci () {
    await api.esci().catch(() => {})
    setUtente(null)
    aCasa()
  }

  // Le tre sezioni con la barra in basso: casa, lavori, blocco note.
  const sezione = (nome) => vaiA(nome)

  if (!controllato) return <div className="vuoto" style={{ paddingTop: '38vh' }}>Apro Fieldbook…</div>
  if (!utente) return <Accesso quandoEntra={(u) => { setUtente(u); aCasa() }} />

  const apriSquadra = (modo) => vaiA('squadra', { mioPin: modo === 'mio-pin' })

  const schermo = () => {
    switch (schermata.nome) {
      case 'lavoro':
        return (
          <Lavoro
            id={schermata.id} utente={utente} segnale={segnale}
            indietro={() => vaiA(schermata.da || 'home', schermata.da === 'lavori' ? { vista: vistaLavori } : {})}
          />
        )

      case 'nuovo':
        return (
          <NuovoLavoro
            utente={utente} indietro={aCasa}
            quandoCreato={(id) => vaiA('lavoro', { id })}
          />
        )

      case 'note':
        return <Note vaiA={sezione} />

      case 'squadra':
        return <Squadra utente={utente} indietro={aCasa} apriSubitoMioPin={schermata.mioPin} />

      case 'lavori':
        return (
          <Lavori
            utente={utente} segnale={segnale} esci={esci} vaiA={sezione}
            vistaIniziale={schermata.vista} ricordaVista={setVistaLavori}
            apriLavoro={(id) => vaiA('lavoro', { id, da: 'lavori' })}
            apriNuovo={() => vaiA('nuovo')}
            apriSquadra={apriSquadra}
            apriNote={() => vaiA('note')}
          />
        )

      default:
        return (
          <Home
            utente={utente} segnale={segnale} vaiA={sezione}
            apriLavoro={(id) => vaiA('lavoro', { id })}
            apriNuovo={() => vaiA('nuovo')}
            apriNote={() => vaiA('note')}
            apriLavori={(vista) => vaiA('lavori', { vista })}
            apriMenu={() => setMenu(true)}
          />
        )
    }
  }

  return (
    <>
      {schermo()}
      {menu && (
        <Menu
          utente={utente} chiudi={() => setMenu(false)}
          apriNote={() => vaiA('note')} apriSquadra={apriSquadra} esci={esci}
        />
      )}
    </>
  )
}
