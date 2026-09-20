import { useEffect, useRef, useState } from 'react'
import { caricaFirma } from './api.js'
import { nomeCliente } from './utili.js'

// Il cliente firma con il dito sullo schermo, a fine montaggio.
// La firma diventa un'immagine e resta attaccata al lavoro.
export default function Firma ({ lavoro, chiudi, quandoSalvata }) {
  const tela = useRef(null)
  const sto = useRef(false)
  const [vuota, setVuota] = useState(true)
  const [nome, setNome] = useState(nomeCliente(lavoro))
  const [nota, setNota] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => { pulisci() }, [])

  function pennello () {
    const ctx = tela.current.getContext('2d')
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#14243a'
    return ctx
  }

  function pulisci () {
    const c = tela.current
    if (!c) return
    const misure = c.getBoundingClientRect()
    const densita = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(misure.width * densita)
    c.height = Math.round(misure.height * densita)

    const ctx = c.getContext('2d')
    ctx.setTransform(densita, 0, 0, densita, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, misure.width, misure.height)
    setVuota(true)
  }

  const punto = (e) => {
    const m = tela.current.getBoundingClientRect()
    return { x: e.clientX - m.left, y: e.clientY - m.top }
  }

  function giu (e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = punto(e)
    const ctx = pennello()
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    // Un tocco secco deve lasciare comunque un segno.
    ctx.lineTo(p.x + 0.1, p.y + 0.1)
    ctx.stroke()
    sto.current = true
    setVuota(false)
  }

  function muovi (e) {
    if (!sto.current) return
    const p = punto(e)
    const ctx = tela.current.getContext('2d')
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const su = () => { sto.current = false }

  async function salva () {
    if (vuota || salvo) return
    setSalvo(true)
    setErrore('')
    try {
      const immagine = await new Promise((r) => tela.current.toBlob(r, 'image/png'))
      if (!immagine) throw new Error('Non riesco a leggere la firma. Riprova.')
      const firma = await caricaFirma(lavoro.id, immagine, {
        nome_cliente: nome.trim() || null,
        nota: nota.trim() || null
      })
      quandoSalvata(firma)
    } catch (e) {
      setErrore(e.message)
      setSalvo(false)
    }
  }

  return (
    <div className="pagina-firma">
      <header className="testata">
        <button className="indietro" onClick={chiudi} aria-label="Chiudi">✕</button>
        <h1>Firma del cliente</h1>
      </header>

      <div className="contenuto">
        {errore && <div className="errore">{errore}</div>}

        <p className="riga-vuota">
          Fai firmare il cliente qui sotto con il dito. Serve a te: resta attaccata al lavoro
          e finisce nel resoconto per l'azienda.
        </p>

        <div className="riquadro-firma">
          <canvas
            ref={tela}
            onPointerDown={giu} onPointerMove={muovi}
            onPointerUp={su} onPointerLeave={su} onPointerCancel={su}
          />
          {vuota && <span className="suggerimento">Firma qui</span>}
        </div>

        <div className="due" style={{ marginBottom: 12 }}>
          <button className="bottone chiaro piccolo" onClick={pulisci} disabled={vuota || salvo}>
            Cancella e rifai
          </button>
          <button className="bottone arancio piccolo" onClick={salva} disabled={vuota || salvo}>
            {salvo ? 'Salvo…' : 'Salva la firma'}
          </button>
        </div>

        <div className="carta">
          <div className="campo">
            <label htmlFor="chi">Chi ha firmato</label>
            <input id="chi" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Nome e cognome del cliente" />
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor="nota-firma">Nota (facoltativa)</label>
            <input id="nota-firma" value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Montaggio completato, manca il piano cottura…" />
          </div>
        </div>
      </div>
    </div>
  )
}
