import { useCallback, useEffect, useRef, useState } from 'react'

// Il serpente a pixel: il gioco nascosto dell'app. Sta in un riquadro della
// schermata di casa e si gioca col dito, trascinando o con le frecce.
const COLONNE = 15
const RIGHE = 15
const PASSO_INIZIALE = 190     // millisecondi fra un movimento e l'altro
const PASSO_MINIMO = 90

const VERSI = {
  su: { x: 0, y: -1 }, giu: { x: 0, y: 1 }, sinistra: { x: -1, y: 0 }, destra: { x: 1, y: 0 }
}
const OPPOSTI = { su: 'giu', giu: 'su', sinistra: 'destra', destra: 'sinistra' }

const RECORD = 'silcom-snake-record'
const leggiRecord = () => Number(localStorage.getItem(RECORD) || 0)

export default function Snake ({ grande = false, chiudi }) {
  const tela = useRef(null)
  const partita = useRef(null)
  const punteggio = useRef(0)
  const [punti, setPunti] = useState(0)
  const [record, setRecord] = useState(() => { try { return leggiRecord() } catch { return 0 } })
  const [stato, setStato] = useState('fermo')   // fermo | gioca | finita

  const nuovaPartita = useCallback(() => {
    partita.current = {
      corpo: [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }],
      verso: 'destra',
      prossimo: 'destra',
      mela: { x: 11, y: 8 },
      passo: PASSO_INIZIALE,
      ultimo: 0
    }
    punteggio.current = 0
    setPunti(0)
    setStato('gioca')
  }, [])

  const sterza = useCallback((dove) => {
    const p = partita.current
    if (!p || stato === 'finita') return
    if (OPPOSTI[dove] === p.verso) return    // non si torna indietro su se stessi
    p.prossimo = dove
  }, [stato])

  // Disegno e movimento stanno insieme: il gioco gira anche quando React
  // non ridisegna niente.
  useEffect(() => {
    const c = tela.current
    if (!c) return

    const ctx = c.getContext('2d')
    let vivo = true

    const misura = () => {
      const largo = c.parentElement.clientWidth
      // A tutto schermo il campo si prende quello che c'e', ma resta quadrato
      // e lascia posto alle frecce sotto.
      const altoMax = grande ? window.innerHeight * 0.58 : Infinity
      const lato = Math.floor(Math.min(largo / COLONNE, altoMax / RIGHE))
      const densita = Math.min(window.devicePixelRatio || 1, 2)
      c.width = lato * COLONNE * densita
      c.height = lato * RIGHE * densita
      c.style.width = `${lato * COLONNE}px`
      c.style.height = `${lato * RIGHE}px`
      ctx.setTransform(densita, 0, 0, densita, 0, 0)
      return lato
    }

    let lato = misura()
    const quandoCambia = () => { lato = misura() }
    window.addEventListener('resize', quandoCambia)

    const quadretto = (x, y, colore, bordo = 1) => {
      ctx.fillStyle = colore
      ctx.fillRect(x * lato + bordo, y * lato + bordo, lato - bordo * 2, lato - bordo * 2)
    }

    function disegna () {
      ctx.fillStyle = '#0d1626'
      ctx.fillRect(0, 0, lato * COLONNE, lato * RIGHE)

      // la griglia, appena accennata
      ctx.fillStyle = 'rgba(255,255,255,.045)'
      for (let x = 0; x < COLONNE; x++) {
        for (let y = 0; y < RIGHE; y++) ctx.fillRect(x * lato + lato / 2 - 1, y * lato + lato / 2 - 1, 2, 2)
      }

      const p = partita.current
      if (!p) return

      quadretto(p.mela.x, p.mela.y, '#5ad07a')
      p.corpo.forEach((pezzo, i) => quadretto(pezzo.x, pezzo.y, i === 0 ? '#ffc76b' : '#f4a63a'))
    }

    function muovi () {
      const p = partita.current
      p.verso = p.prossimo
      const v = VERSI[p.verso]
      const testa = { x: p.corpo[0].x + v.x, y: p.corpo[0].y + v.y }

      const fuori = testa.x < 0 || testa.y < 0 || testa.x >= COLONNE || testa.y >= RIGHE
      const addosso = p.corpo.some((q) => q.x === testa.x && q.y === testa.y)
      if (fuori || addosso) {
        setStato('finita')
        try {
          if (punteggio.current > leggiRecord()) {
            localStorage.setItem(RECORD, String(punteggio.current))
            setRecord(punteggio.current)
          }
        } catch { /* modalita' anonima */ }
        return
      }

      p.corpo.unshift(testa)
      if (testa.x === p.mela.x && testa.y === p.mela.y) {
        punteggio.current += 1
        setPunti(punteggio.current)
        p.passo = Math.max(PASSO_MINIMO, p.passo - 5)
        // la mela nuova non finisce mai sotto il serpente
        const liberi = []
        for (let x = 0; x < COLONNE; x++) {
          for (let y = 0; y < RIGHE; y++) {
            if (!p.corpo.some((q) => q.x === x && q.y === y)) liberi.push({ x, y })
          }
        }
        p.mela = liberi[Math.floor(Math.random() * liberi.length)] || p.mela
      } else {
        p.corpo.pop()
      }
    }

    // Quando non si sta giocando il campo si disegna una volta sola: il
    // telefono non deve consumare batteria per una figura ferma.
    function giro (ora) {
      if (!vivo) return
      const p = partita.current
      if (p && stato === 'gioca') {
        if (!p.ultimo) p.ultimo = ora
        if (ora - p.ultimo >= p.passo) { p.ultimo = ora; muovi() }
      }
      disegna()
      if (stato === 'gioca') requestAnimationFrame(giro)
    }
    requestAnimationFrame(giro)

    return () => { vivo = false; window.removeEventListener('resize', quandoCambia) }
  }, [stato, grande])

  useEffect(() => {
    const tasto = (e) => {
      const dove = { ArrowUp: 'su', ArrowDown: 'giu', ArrowLeft: 'sinistra', ArrowRight: 'destra' }[e.key]
      if (!dove) return
      e.preventDefault()
      if (stato !== 'gioca') nuovaPartita()
      sterza(dove)
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [sterza, stato, nuovaPartita])

  // Trascinando il dito sul campo si sterza, come nel gioco del telefono.
  const tocco = useRef(null)
  const giu = (e) => { tocco.current = { x: e.clientX, y: e.clientY } }
  function su (e) {
    if (!tocco.current) return
    const dx = e.clientX - tocco.current.x
    const dy = e.clientY - tocco.current.y
    tocco.current = null
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return
    sterza(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'destra' : 'sinistra') : (dy > 0 ? 'giu' : 'su'))
  }

  return (
    <div className={`gioco ${grande ? 'grande' : ''}`}>
      <div className="testa-gioco">
        <strong>🐍 Snake</strong>
        <span>Punti {punti} · record {record}</span>
        {chiudi && <button className="azione-testata" onClick={chiudi}>Chiudi</button>}
      </div>

      <div className="campo" onPointerDown={giu} onPointerUp={su} onPointerCancel={() => { tocco.current = null }}>
        <canvas ref={tela} />

        {stato !== 'gioca' && (
          <div className="sopra-campo">
            {stato === 'finita' && <strong>Hai fatto {punti}</strong>}
            <button className="bottone arancio piccolo" onClick={nuovaPartita}>
              {stato === 'finita' ? 'Rigioca' : 'Gioca'}
            </button>
          </div>
        )}
      </div>

      <div className="frecce">
        <button onClick={() => sterza('su')} aria-label="Su">▲</button>
        <div>
          <button onClick={() => sterza('sinistra')} aria-label="Sinistra">◀</button>
          <button onClick={() => sterza('destra')} aria-label="Destra">▶</button>
        </div>
        <button onClick={() => sterza('giu')} aria-label="Giù">▼</button>
      </div>
    </div>
  )
}
