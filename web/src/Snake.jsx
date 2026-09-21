import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { verso as suonaVerso } from './suono.js'

// Il serpente: il gioco nascosto dell'app. Si guida col dito, trascinando
// sul campo; non ci sono tasti finti sullo schermo.
const COLONNE = 16
const RIGHE = 16

const PASSO_BASE = 168          // millisecondi fra un movimento e l'altro
const PASSO_MINIMO = 108
const TURBO = 0.55              // quanto accorcia il passo il fulmine
const DURATA_TURBO = 5200
const DURATA_STELLA = 6500

// I quattro tipi di cibo. Quelli speciali restano in campo per poco: o li
// prendi, o tornano una mela normale.
const CIBI = {
  mela: { punti: 1, cresce: 1, colore: '#5ad07a', vive: 0 },
  grossa: { punti: 5, cresce: 2, colore: '#ffd166', vive: 8000 },
  turbo: { punti: 1, cresce: 1, colore: '#7cc4ff', vive: 7000 },
  stella: { punti: 2, cresce: 1, colore: '#c48cff', vive: 7000 }
}

const VERSI = {
  su: { x: 0, y: -1 }, giu: { x: 0, y: 1 }, sinistra: { x: -1, y: 0 }, destra: { x: 1, y: 0 }
}
const OPPOSTI = { su: 'giu', giu: 'su', sinistra: 'destra', destra: 'sinistra' }

const RECORD = 'silcom-snake-record'
const leggiRecord = () => { try { return Number(localStorage.getItem(RECORD) || 0) } catch { return 0 } }

export default function Snake ({ grande = false, chiudi }) {
  const tela = useRef(null)
  const partita = useRef(null)
  const punteggio = useRef(0)

  const [punti, setPunti] = useState(0)
  const [record, setRecord] = useState(leggiRecord)
  const [stato, setStato] = useState('fermo')     // fermo | gioca | pausa | finita
  const [potere, setPotere] = useState(null)      // { tipo, resta }
  const [classifica, setClassifica] = useState([])

  const nuovaPartita = useCallback(() => {
    partita.current = {
      corpo: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }],
      verso: 'destra',
      prossimo: 'destra',
      cibo: { x: 12, y: 8, tipo: 'mela', nato: performance.now() },
      passo: PASSO_BASE,
      ultimo: 0,
      cresce: 0,
      codaFerma: false,
      turboFino: 0,
      stellaFino: 0,
      briciole: [],
      volanti: []
    }
    punteggio.current = 0
    setPunti(0)
    setPotere(null)
    setStato('gioca')
  }, [])

  const sterza = useCallback((dove) => {
    const p = partita.current
    if (!p) return
    if (OPPOSTI[dove] === p.verso) return      // non si torna indietro su se stessi
    p.prossimo = dove
  }, [])

  // Il campo, il movimento e tutti i disegni stanno qui dentro: il gioco
  // gira anche quando React non ridisegna niente.
  useEffect(() => {
    const c = tela.current
    if (!c) return
    const ctx = c.getContext('2d')
    let vivo = true

    const misura = () => {
      const largo = (c.closest('.campo') || c.parentElement).clientWidth
      // A tutto schermo il campo si prende quello che c'e', ma resta quadrato.
      const altoMax = grande ? window.innerHeight * 0.62 : Infinity
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

    const centro = (cella) => ({ x: (cella.x + 0.5) * lato, y: (cella.y + 0.5) * lato })

    /* ------------------------------------------------------------ disegno */

    function sfondo () {
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, lato * COLONNE, lato * RIGHE)
    }

    // Il serpente e' una linea sola, spessa e con gli angoli tondi: molto
    // piu' pulito dei quadretti, e il movimento si vede scorrere.
    function serpente (p, t) {
      const punti = p.corpo.map(centro)
      const v = VERSI[p.verso]

      // la testa esce in avanti man mano che passa il tempo, la coda rientra
      punti[0] = { x: punti[0].x + v.x * lato * t, y: punti[0].y + v.y * lato * t }
      if (!p.codaFerma && punti.length > 1) {
        const ultimo = punti[punti.length - 1]
        const prima = punti[punti.length - 2]
        const dx = prima.x - ultimo.x
        const dy = prima.y - ultimo.y
        // se la coda ha appena attraversato il muro il salto e' enorme: si lascia stare
        if (Math.abs(dx) <= lato * 1.5 && Math.abs(dy) <= lato * 1.5) {
          punti[punti.length - 1] = { x: ultimo.x + dx * t, y: ultimo.y + dy * t }
        }
      }

      const stella = p.stellaFino > performance.now()
      const turbo = p.turboFino > performance.now()

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = lato * (turbo ? 0.78 : 0.72)
      ctx.strokeStyle = stella
        ? `hsl(${(performance.now() / 6) % 360} 90% 66%)`
        : (turbo ? '#ffd479' : '#f4a63a')
      ctx.shadowColor = ctx.strokeStyle
      ctx.shadowBlur = stella ? 16 : (turbo ? 14 : 6)

      // dove il serpente attraversa il muro la linea va spezzata
      let pezzo = [punti[0]]
      for (let i = 1; i < punti.length; i++) {
        const salto = Math.abs(punti[i].x - punti[i - 1].x) > lato * 1.6 ||
                      Math.abs(punti[i].y - punti[i - 1].y) > lato * 1.6
        if (salto) { tratto(pezzo); pezzo = [] }
        pezzo.push(punti[i])
      }
      tratto(pezzo)
      ctx.shadowBlur = 0

      occhi(punti[0], v, lato)
    }

    function tratto (punti) {
      if (punti.length === 0) return
      ctx.beginPath()
      ctx.moveTo(punti[0].x, punti[0].y)
      for (let i = 1; i < punti.length; i++) ctx.lineTo(punti[i].x, punti[i].y)
      if (punti.length === 1) ctx.lineTo(punti[0].x + 0.01, punti[0].y + 0.01)
      ctx.stroke()
    }

    function occhi (testa, v, lato) {
      const avanti = lato * 0.14
      const lato2 = lato * 0.16
      const raggio = Math.max(1.6, lato * 0.07)
      ctx.fillStyle = '#10192a'
      for (const segno of [1, -1]) {
        const x = testa.x + v.x * avanti - v.y * lato2 * segno
        const y = testa.y + v.y * avanti + v.x * lato2 * segno
        ctx.beginPath()
        ctx.arc(x, y, raggio, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function cibo (p, ora) {
      const c = p.cibo
      const tipo = CIBI[c.tipo]
      const m = centro(c)
      const battito = 1 + Math.sin(ora / 170) * 0.09
      const base = lato * (c.tipo === 'grossa' ? 0.34 : 0.26) * battito

      // quanto gli resta da vivere, disegnato come un anello che si consuma
      if (tipo.vive) {
        const restante = Math.max(0, 1 - (ora - c.nato) / tipo.vive)
        ctx.strokeStyle = tipo.colore
        ctx.globalAlpha = 0.7
        ctx.lineWidth = Math.max(2, lato * 0.09)
        ctx.beginPath()
        ctx.arc(m.x, m.y, lato * 0.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * restante)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      ctx.fillStyle = tipo.colore
      ctx.shadowColor = tipo.colore
      ctx.shadowBlur = 12

      if (c.tipo === 'stella') stellaDisegno(m, base * 1.15)
      else if (c.tipo === 'turbo') fulmine(m, base * 1.25)
      else { ctx.beginPath(); ctx.arc(m.x, m.y, base, 0, Math.PI * 2); ctx.fill() }

      ctx.shadowBlur = 0
    }

    function stellaDisegno (m, r) {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const raggio = i % 2 === 0 ? r : r * 0.44
        const a = -Math.PI / 2 + (Math.PI * i) / 5
        const x = m.x + Math.cos(a) * raggio
        const y = m.y + Math.sin(a) * raggio
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }

    function fulmine (m, r) {
      ctx.beginPath()
      ctx.moveTo(m.x + r * 0.30, m.y - r)
      ctx.lineTo(m.x - r * 0.45, m.y + r * 0.12)
      ctx.lineTo(m.x + r * 0.02, m.y + r * 0.12)
      ctx.lineTo(m.x - r * 0.28, m.y + r)
      ctx.lineTo(m.x + r * 0.50, m.y - r * 0.18)
      ctx.lineTo(m.x + r * 0.05, m.y - r * 0.18)
      ctx.closePath()
      ctx.fill()
    }

    function briciole (p, ora) {
      p.briciole = p.briciole.filter((b) => ora - b.nato < 520)
      for (const b of p.briciole) {
        const t = (ora - b.nato) / 520
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = b.colore
        const x = b.x + b.vx * t * lato * 2.4
        const y = b.y + b.vy * t * lato * 2.4
        ctx.beginPath()
        ctx.arc(x, y, Math.max(1, lato * 0.10 * (1 - t)), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function volanti (p, ora) {
      p.volanti = p.volanti.filter((v) => ora - v.nato < 900)
      ctx.textAlign = 'center'
      ctx.font = `700 ${Math.round(lato * 0.62)}px -apple-system, Segoe UI, Roboto, sans-serif`
      for (const v of p.volanti) {
        const t = (ora - v.nato) / 900
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = v.colore
        ctx.fillText(v.testo, v.x, v.y - t * lato * 1.6)
      }
      ctx.globalAlpha = 1
    }

    /* ----------------------------------------------------------- movimento */

    const passoOra = (p) => (p.turboFino > performance.now() ? p.passo * TURBO : p.passo)

    function nuovoCibo (p, ora) {
      const liberi = []
      for (let x = 0; x < COLONNE; x++) {
        for (let y = 0; y < RIGHE; y++) {
          if (!p.corpo.some((q) => q.x === x && q.y === y)) liberi.push({ x, y })
        }
      }
      const posto = liberi[Math.floor(Math.random() * liberi.length)] || { x: 0, y: 0 }

      // i bonus arrivano quando la partita si e' scaldata
      const n = Math.random()
      let tipo = 'mela'
      if (punteggio.current >= 3 && n < 0.16) tipo = 'grossa'
      else if (punteggio.current >= 4 && n < 0.30) tipo = 'turbo'
      else if (punteggio.current >= 8 && n < 0.40) tipo = 'stella'

      p.cibo = { ...posto, tipo, nato: ora }
    }

    function mangia (p, ora) {
      const tipo = CIBI[p.cibo.tipo]
      const doppio = p.turboFino > ora
      const presi = tipo.punti * (doppio ? 2 : 1)

      punteggio.current += presi
      setPunti(punteggio.current)
      p.cresce += tipo.cresce
      p.passo = Math.max(PASSO_MINIMO, p.passo - 3)

      if (p.cibo.tipo === 'turbo') p.turboFino = ora + DURATA_TURBO
      if (p.cibo.tipo === 'stella') p.stellaFino = ora + DURATA_STELLA

      const m = centro(p.cibo)
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10
        p.briciole.push({ x: m.x, y: m.y, vx: Math.cos(a), vy: Math.sin(a), colore: tipo.colore, nato: ora })
      }
      p.volanti.push({ x: m.x, y: m.y, testo: `+${presi}`, colore: tipo.colore, nato: ora })
      suonaVerso(p.cibo.tipo)

      nuovoCibo(p, ora)
    }

    function muovi (ora) {
      const p = partita.current
      p.verso = p.prossimo
      const v = VERSI[p.verso]
      const stella = p.stellaFino > ora
      let testa = { x: p.corpo[0].x + v.x, y: p.corpo[0].y + v.y }

      if (stella) {
        // con la stella si passa da una parte all'altra del campo
        testa = { x: (testa.x + COLONNE) % COLONNE, y: (testa.y + RIGHE) % RIGHE }
      } else if (testa.x < 0 || testa.y < 0 || testa.x >= COLONNE || testa.y >= RIGHE) {
        return finisci(p)
      }
      if (p.corpo.some((q) => q.x === testa.x && q.y === testa.y)) return finisci(p)

      p.corpo.unshift(testa)
      if (testa.x === p.cibo.x && testa.y === p.cibo.y) mangia(p, ora)

      if (p.cresce > 0) { p.cresce -= 1; p.codaFerma = true } else { p.corpo.pop(); p.codaFerma = false }

      // un bonus scaduto senza prenderlo torna una mela
      const tipo = CIBI[p.cibo.tipo]
      if (tipo.vive && ora - p.cibo.nato > tipo.vive) p.cibo = { ...p.cibo, tipo: 'mela', nato: ora }
    }

    function finisci (p) {
      p.finita = true
      suonaVerso('fine')
      setStato('finita')
    }

    /* --------------------------------------------------------------- giro */

    function giro (ora) {
      if (!vivo) return
      const p = partita.current
      let t = 0

      if (p && stato === 'gioca' && !p.finita) {
        if (!p.ultimo) p.ultimo = ora
        const passo = passoOra(p)
        while (ora - p.ultimo >= passo && !p.finita) { p.ultimo += passo; muovi(ora) }
        t = p.finita ? 1 : Math.min(1, (ora - p.ultimo) / passo)
      }

      sfondo()
      if (p) {
        cibo(p, ora)
        serpente(p, t)
        briciole(p, ora)
        volanti(p, ora)
      }

      if (stato === 'gioca') requestAnimationFrame(giro)
    }
    requestAnimationFrame(giro)

    return () => { vivo = false; window.removeEventListener('resize', quandoCambia) }
  }, [stato, grande])

  // Il riquadro colorato che dice quanto dura il bonus.
  useEffect(() => {
    if (stato !== 'gioca') return setPotere(null)
    const t = setInterval(() => {
      const p = partita.current
      if (!p) return
      const ora = performance.now()
      if (p.stellaFino > ora) setPotere({ tipo: 'stella', resta: Math.ceil((p.stellaFino - ora) / 1000) })
      else if (p.turboFino > ora) setPotere({ tipo: 'turbo', resta: Math.ceil((p.turboFino - ora) / 1000) })
      else setPotere(null)
    }, 250)
    return () => clearInterval(t)
  }, [stato])

  // Finita la partita: si segna il record e si guarda la classifica.
  useEffect(() => {
    if (stato !== 'finita') return
    const fatti = punteggio.current
    if (fatti > leggiRecord()) {
      try { localStorage.setItem(RECORD, String(fatti)) } catch { /* modalita' anonima */ }
      setRecord(fatti)
    }
    api.salvaPunteggio(fatti)
      .then((r) => setRecord((vecchio) => Math.max(vecchio, r.record)))
      .catch(() => {})
      .finally(() => api.classifica().then(setClassifica).catch(() => {}))
  }, [stato])

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

  /* ------------------------------------------------------------ il dito */

  // Si guida trascinando sul campo: appena il dito si sposta abbastanza il
  // serpente gira, e il conto riparte da li'. Cosi' si possono incatenare
  // due curve senza staccare il dito.
  const dito = useRef(null)
  const SOGLIA = 22

  const premuto = (e) => {
    // Il dito si "aggancia" al campo solo mentre si gioca: se c'e' il
    // cartello sopra, il tocco deve arrivare al suo tasto.
    if (stato === 'gioca') e.currentTarget.setPointerCapture?.(e.pointerId)
    dito.current = { x: e.clientX, y: e.clientY, mosso: false }
  }

  function trascinato (e) {
    const d = dito.current
    if (!d || stato !== 'gioca') return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) < SOGLIA && Math.abs(dy) < SOGLIA) return
    sterza(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'destra' : 'sinistra') : (dy > 0 ? 'giu' : 'su'))
    dito.current = { x: e.clientX, y: e.clientY, mosso: true }
  }

  function lasciato () {
    const d = dito.current
    dito.current = null
    // un tocco secco, senza trascinare, mette in pausa
    if (d && !d.mosso && stato === 'gioca') setStato('pausa')
    else if (d && !d.mosso && stato === 'pausa') setStato('gioca')
  }

  const etichette = { turbo: '⚡ Turbo · punti doppi', stella: '✦ Stella · passi i muri' }

  return (
    <div className={`gioco ${grande ? 'grande' : ''}`}>
      <div className="testa-gioco">
        <strong>SNAKE</strong>
        <span className="conto">{punti}<small> / record {record}</small></span>
        {chiudi && <button className="azione-testata" onClick={chiudi}>Chiudi</button>}
      </div>

      <div
        className={`campo ${stato === 'gioca' || grande ? 'attivo' : ''}`}
        onPointerDown={premuto} onPointerMove={trascinato}
        onPointerUp={lasciato} onPointerCancel={() => { dito.current = null }}
      >
        <div className="tavolo">
        <canvas ref={tela} />

        {potere && <div className={`potere ${potere.tipo}`}>{etichette[potere.tipo]} · {potere.resta}s</div>}

        {stato !== 'gioca' && (
          <div className="sopra-campo">
            {stato === 'finita' && (
              <>
                <strong>{punti} {punti === 1 ? 'punto' : 'punti'}</strong>
                {punti > 0 && punti >= record && <span className="nuovo-record">nuovo record</span>}
                {classifica.length > 0 && (
                  <ol className="classifica">
                    {classifica.slice(0, 5).map((r) => (
                      <li key={r.id} className={r.io ? 'io' : ''}>
                        <span>{r.nome}</span><b>{r.record}</b>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            {stato === 'pausa' && <strong>In pausa</strong>}

            <button className="bottone arancio piccolo" onClick={() => (stato === 'pausa' ? setStato('gioca') : nuovaPartita())}>
              {stato === 'finita' ? 'Rigioca' : (stato === 'pausa' ? 'Riprendi' : 'Gioca')}
            </button>

            {stato === 'fermo' && <span className="come">Trascina il dito sul campo per girare</span>}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
