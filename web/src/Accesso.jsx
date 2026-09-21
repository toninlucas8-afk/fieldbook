import { useState } from 'react'
import { api } from './api.js'

export default function Accesso ({ quandoEntra }) {
  const [nome, setNome] = useState(localStorage.getItem('fb_ultimo_nome') || '')
  const [pin, setPin] = useState('')
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)

  async function invia (e) {
    e.preventDefault()
    setErrore('')
    setAttesa(true)
    try {
      const { utente } = await api.entra(nome, pin)
      localStorage.setItem('fb_ultimo_nome', nome.trim())
      quandoEntra(utente)
    } catch (err) {
      setErrore(err.message)
      setPin('')
    } finally {
      setAttesa(false)
    }
  }

  return (
    <div className="accesso">
      <div className="marchio">
        <img src="/icona.svg" alt="" />
        <h1>Silcom</h1>
        <p>I lavori della squadra, sempre aggiornati</p>
      </div>

      <form onSubmit={invia}>
        {errore && <div className="errore">{errore}</div>}

        <div className="campo">
          <label htmlFor="nome">Il tuo nome</label>
          <input
            id="nome" value={nome} onChange={(e) => setNome(e.target.value)}
            autoComplete="username" placeholder="Come ti ha registrato Luca" required
          />
        </div>

        <div className="campo">
          <label htmlFor="pin">Il tuo PIN</label>
          <input
            id="pin" className="pin-input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric" autoComplete="current-password" maxLength={8} placeholder="······" required
          />
        </div>

        <button className="bottone arancio" disabled={attesa || !nome || pin.length < 4}>
          {attesa ? 'Un attimo…' : 'Entra'}
        </button>
      </form>

      <p style={{ opacity: .6, fontSize: 13.5, textAlign: 'center', marginTop: 22 }}>
        Il PIN te lo dà Luca. Lo digiti solo la prima volta su questo telefono.
      </p>
    </div>
  )
}
