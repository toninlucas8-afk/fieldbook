import { useEffect, useState } from 'react'
import { api } from './api.js'
import { iniziali, quando } from './utili.js'

export default function Squadra ({ utente, indietro, apriSubitoMioPin }) {
  const [persone, setPersone] = useState([])
  const [errore, setErrore] = useState('')
  const [nuova, setNuova] = useState(false)
  const [mioPin, setMioPin] = useState(!!apriSubitoMioPin)
  const [pinMostrato, setPinMostrato] = useState(null) // { nome, pin }

  const ricarica = () => api.squadra().then(setPersone).catch((e) => setErrore(e.message))
  useEffect(() => { ricarica() }, [])

  async function rigenera (persona) {
    if (!confirm(`Genero un PIN nuovo per ${persona.nome}? Quello vecchio smette di funzionare subito.`)) return
    try {
      const r = await api.nuovoPin(persona.id)
      setPinMostrato({ nome: r.nome, pin: r.pin })
      ricarica()
    } catch (e) { setErrore(e.message) }
  }

  async function cambiaAttivo (persona) {
    const attiva = !persona.attivo
    const domanda = attiva
      ? `Riattivo ${persona.nome}?`
      : `Tolgo l'accesso a ${persona.nome}? Le foto che ha caricato restano al loro posto.`
    if (!confirm(domanda)) return
    try {
      await api.attivaPersona(persona.id, attiva)
      ricarica()
    } catch (e) { setErrore(e.message) }
  }

  return (
    <>
      <header className="testata">
        <button className="indietro" onClick={indietro} aria-label="Indietro">‹</button>
        <h1>Squadra<span className="sotto">{persone.filter((p) => p.attivo).length} persone attive</span></h1>
      </header>

      <div className="contenuto">
        {errore && <div className="errore">{errore}</div>}

        {pinMostrato && <PinDaConsegnare {...pinMostrato} chiudi={() => setPinMostrato(null)} />}

        {persone.map((p) => (
          <div className={`carta persona ${p.attivo ? '' : 'spenta'}`} key={p.id}>
            <div className="cerchio">{iniziali(p.nome)}</div>

            <div className="corpo">
              <strong>{p.nome} {p.ruolo === 'admin' && <span className="etichetta">admin</span>}</strong>
              <span>
                {p.attivo
                  ? (p.ultimo_accesso ? `visto ${quando(p.ultimo_accesso)}` : 'non è ancora entrato')
                  : 'accesso revocato'}
                {p.foto_caricate > 0 && ` · ${p.foto_caricate} foto`}
              </span>
            </div>

            <details style={{ position: 'relative' }}>
              <summary className="bottone chiaro piccolo" style={{ listStyle: 'none' }}>⋯</summary>
              <div className="carta" style={{ position: 'absolute', right: 0, top: 46, width: 210, zIndex: 10, padding: 8 }}>
                <button className="bottone chiaro piccolo" style={{ width: '100%', marginBottom: 6 }} onClick={() => rigenera(p)}>
                  PIN nuovo
                </button>
                {p.id !== utente.id && (
                  <button className={`bottone ${p.attivo ? 'pericolo' : 'chiaro'} piccolo`} style={{ width: '100%' }} onClick={() => cambiaAttivo(p)}>
                    {p.attivo ? 'Togli accesso' : 'Riattiva'}
                  </button>
                )}
              </div>
            </details>
          </div>
        ))}

        <button className="bottone chiaro" style={{ marginTop: 6 }} onClick={() => setMioPin(true)}>
          Cambia il mio PIN
        </button>
      </div>

      <div className="barra-azione">
        <button className="bottone arancio" onClick={() => setNuova(true)}>+ Aggiungi persona</button>
      </div>

      {nuova && (
        <NuovaPersona
          chiudi={() => setNuova(false)}
          quandoCreata={(r) => { setNuova(false); setPinMostrato({ nome: r.nome, pin: r.pin }); ricarica() }}
        />
      )}

      {mioPin && <CambiaMioPin chiudi={() => setMioPin(false)} />}
    </>
  )
}

// Il PIN si vede solo adesso: dopo resta salvato cifrato e non e' piu' leggibile.
function PinDaConsegnare ({ nome, pin, chiudi }) {
  const messaggio = `Ciao ${nome.split(' ')[0]}, questo è il tuo accesso a Fieldbook.\nNome: ${nome}\nPIN: ${pin}\n\nApri il link dell'app, entra con nome e PIN, poi aggiungila alla schermata iniziale.`

  return (
    <div className="pin-mostrato">
      <strong>PIN per {nome}</strong>
      <div className="cifre">{pin}</div>
      <small>Questo PIN non sarà più visibile. Mandaglielo adesso.</small>

      <div style={{ display: 'flex', gap: 8 }}>
        <a className="bottone arancio piccolo" style={{ flex: 1 }}
          href={`https://wa.me/?text=${encodeURIComponent(messaggio)}`} target="_blank" rel="noreferrer">
          Manda su WhatsApp
        </a>
        <button className="bottone chiaro piccolo" style={{ flex: 1 }}
          onClick={() => navigator.clipboard?.writeText(messaggio)}>
          Copia
        </button>
      </div>

      <button className="bottone chiaro piccolo" style={{ width: '100%', marginTop: 8 }} onClick={chiudi}>
        Fatto, l'ho mandato
      </button>
    </div>
  )
}

function NuovaPersona ({ chiudi, quandoCreata }) {
  const [nome, setNome] = useState('')
  const [pin, setPin] = useState('')
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)

  async function invia (e) {
    e.preventDefault()
    setAttesa(true)
    setErrore('')
    try {
      quandoCreata(await api.creaPersona({ nome, pin: pin || null }))
    } catch (err) {
      setErrore(err.message)
      setAttesa(false)
    }
  }

  return (
    <div className="foglio-sfondo" onClick={chiudi}>
      <form className="foglio" onClick={(e) => e.stopPropagation()} onSubmit={invia}>
        <h2>Aggiungi una persona</h2>
        {errore && <div className="errore">{errore}</div>}

        <div className="campo">
          <label htmlFor="np">Nome e cognome</label>
          <input id="np" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required
            placeholder="È il nome con cui entrerà" />
        </div>

        <div className="campo">
          <label htmlFor="pp">PIN (lascia vuoto e lo genero io)</label>
          <input id="pp" value={pin} inputMode="numeric" maxLength={8}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="6 cifre" />
        </div>

        <button className="bottone arancio" disabled={attesa || !nome.trim() || (pin && pin.length < 4)}>
          {attesa ? 'Creo…' : 'Crea e mostrami il PIN'}
        </button>
        <button type="button" className="bottone chiaro" style={{ marginTop: 8 }} onClick={chiudi}>Annulla</button>
      </form>
    </div>
  )
}

function CambiaMioPin ({ chiudi }) {
  const [pin, setPin] = useState('')
  const [errore, setErrore] = useState('')
  const [fatto, setFatto] = useState(false)

  async function invia (e) {
    e.preventDefault()
    try {
      await api.cambiaMioPin(pin)
      setFatto(true)
      // Cambiare PIN scollega tutti i telefoni, anche questo.
      setTimeout(() => location.reload(), 1800)
    } catch (err) { setErrore(err.message) }
  }

  return (
    <div className="foglio-sfondo" onClick={chiudi}>
      <form className="foglio" onClick={(e) => e.stopPropagation()} onSubmit={invia}>
        <h2>Cambia il mio PIN</h2>
        {errore && <div className="errore">{errore}</div>}
        {fatto
          ? <div className="avviso">PIN cambiato. Rientra con quello nuovo.</div>
          : (
            <>
              <div className="campo">
                <label htmlFor="mp">Nuovo PIN</label>
                <input id="mp" className="pin-input" value={pin} inputMode="numeric" maxLength={8} autoFocus
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="avviso">Dopo il cambio devi rientrare su tutti i tuoi telefoni.</div>
              <button className="bottone arancio" disabled={pin.length < 4}>Cambia PIN</button>
              <button type="button" className="bottone chiaro" style={{ marginTop: 8 }} onClick={chiudi}>Annulla</button>
            </>
            )}
      </form>
    </div>
  )
}
