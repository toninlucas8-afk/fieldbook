import { useEffect, useRef, useState } from 'react'
import { api, ritoccaFoto } from './api.js'
import { peso, quando } from './utili.js'

// Il visore delle foto. Si sfoglia con il dito, come nella galleria del
// telefono: non serve uscire e rientrare per vedere la prossima.
export default function Visore ({ foto, indice, utente, chiudi, quandoCambia }) {
  const [i, setI] = useState(indice)
  const [ritocco, setRitocco] = useState(false)
  // Una foto appena ritoccata la mostriamo subito com'e' diventata, senza
  // aspettare che il lavoro si ricarichi: l'immagine vecchia non c'e' piu'.
  const [ritoccate, setRitoccate] = useState({})
  const tocco = useRef(null)

  const quante = foto.length
  const grezza = foto[Math.min(i, quante - 1)]
  const attuale = grezza && { ...grezza, ...ritoccate[grezza.id] }

  const vai = (passo) => setI((x) => Math.min(quante - 1, Math.max(0, x + passo)))

  // Le due foto vicine si scaricano prima, cosi' scorrendo compaiono subito.
  useEffect(() => {
    for (const vicina of [foto[i - 1], foto[i + 1]]) {
      if (vicina) { const im = new Image(); im.src = vicina.url }
    }
  }, [i, foto])

  useEffect(() => {
    const tasto = (e) => {
      if (e.key === 'ArrowLeft') vai(-1)
      if (e.key === 'ArrowRight') vai(1)
      if (e.key === 'Escape') chiudi()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [quante])

  // Trascinare di lato cambia foto; un trascinamento corto non fa niente,
  // altrimenti basterebbe sfiorare lo schermo per saltare avanti.
  const giu = (e) => { tocco.current = { x: e.clientX, y: e.clientY } }
  function su (e) {
    if (!tocco.current) return
    const dx = e.clientX - tocco.current.x
    const dy = e.clientY - tocco.current.y
    tocco.current = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) vai(dx < 0 ? 1 : -1)
  }

  if (!attuale) return null

  if (ritocco) {
    return (
      <Ritocco
        foto={attuale}
        chiudi={() => setRitocco(false)}
        quandoSalvata={(nuova) => {
          setRitoccate((r) => ({ ...r, [nuova.id]: nuova }))
          setRitocco(false)
          quandoCambia({ resta: true })
        }}
      />
    )
  }

  return (
    <div className="visore">
      <div className="barra">
        <button className="indietro" onClick={chiudi} aria-label="Chiudi">✕</button>
        <span className="conta">{i + 1} di {quante}</span>
        <span className="spazio" />
        <button className="azione-testata" onClick={() => setRitocco(true)}>Ritocca</button>
        <a className="azione-testata" href={attuale.url} target="_blank" rel="noreferrer" download>Scarica</a>
      </div>

      <div className="scorri" onPointerDown={giu} onPointerUp={su} onPointerCancel={() => { tocco.current = null }}>
        <img src={attuale.url} alt={attuale.didascalia || ''} draggable="false" />

        {i > 0 && (
          <button className="freccia sinistra" onClick={() => vai(-1)} aria-label="Foto precedente">‹</button>
        )}
        {i < quante - 1 && (
          <button className="freccia destra" onClick={() => vai(1)} aria-label="Foto successiva">›</button>
        )}
      </div>

      <Piede
        key={attuale.id} foto={attuale} utente={utente}
        quandoEliminata={() => {
          // Chi resta prende il posto di quella cancellata.
          if (quante === 1) return quandoCambia()
          setI((x) => Math.min(x, quante - 2))
          quandoCambia({ resta: true })
        }}
      />
    </div>
  )
}

function Piede ({ foto, utente, quandoEliminata }) {
  const [didascalia, setDidascalia] = useState(foto.didascalia || '')
  const [salvata, setSalvata] = useState(false)
  const puoEliminare = utente.ruolo === 'admin' || foto.caricata_da === utente.id

  async function salva () {
    if ((foto.didascalia || '') === didascalia) return
    await api.didascaliaFoto(foto.id, didascalia)
    setSalvata(true)
    setTimeout(() => setSalvata(false), 1600)
  }

  async function elimina () {
    if (!confirm('Elimino questa foto?')) return
    await api.eliminaFoto(foto.id)
    quandoEliminata()
  }

  return (
    <div className="piede">
      <div className="chi">
        <span>
          {foto.caricata_da_nome || 'qualcuno'} · {quando(foto.caricata_il)} · {peso(foto.byte)}
          {foto.ritoccata_il && ' · ritoccata'}
        </span>
        {puoEliminare && (
          <button className="azione-testata" onClick={elimina}>Elimina</button>
        )}
      </div>
      <input
        value={didascalia} onChange={(e) => setDidascalia(e.target.value)}
        onBlur={salva} placeholder="Aggiungi una didascalia…"
      />
      {salvata && <small style={{ color: 'var(--arancio)' }}>Didascalia salvata</small>}
    </div>
  )
}

/* ------------------------------------------------------------- il ritocco */

const PARTENZA = { luce: 100, contrasto: 100, colore: 100, giro: 0 }

const LEVE = [
  { id: 'luce', nome: 'Luminosità', da: 50, a: 160 },
  { id: 'contrasto', nome: 'Contrasto', da: 50, a: 160 },
  { id: 'colore', nome: 'Colore', da: 0, a: 200 }
]

// Le foto in cantiere vengono spesso scure o slavate. Qui si aggiusta
// quello che serve davvero: luce, contrasto, colore e il verso della foto.
function Ritocco ({ foto, chiudi, quandoSalvata }) {
  const [v, setV] = useState(PARTENZA)
  const [salvo, setSalvo] = useState(false)
  const [errore, setErrore] = useState('')

  const filtro = `brightness(${v.luce}%) contrast(${v.contrasto}%) saturate(${v.colore}%)`
  const cambiato = JSON.stringify(v) !== JSON.stringify(PARTENZA)

  async function salva () {
    if (!cambiato || salvo) return
    setSalvo(true)
    setErrore('')
    try {
      const immagine = await disegna(foto.url, v, filtro)
      quandoSalvata(await ritoccaFoto(foto.id, immagine.blob, immagine))
    } catch (e) {
      setErrore(e.message)
      setSalvo(false)
    }
  }

  return (
    <div className="visore ritocco">
      <div className="barra">
        <button className="indietro" onClick={chiudi} aria-label="Chiudi">✕</button>
        <h2>Ritocca la foto</h2>
        <span className="spazio" />
        <button className="azione-testata" onClick={() => setV(PARTENZA)} disabled={!cambiato}>
          Com'era
        </button>
      </div>

      <div className="scorri">
        <img
          src={foto.url} alt="" draggable="false"
          style={{ filter: filtro, transform: `rotate(${v.giro}deg)` }}
        />
      </div>

      <div className="leve">
        {errore && <div className="errore">{errore}</div>}

        {LEVE.map((l) => (
          <label key={l.id}>
            <span>{l.nome}</span>
            <input
              type="range" min={l.da} max={l.a} value={v[l.id]}
              onChange={(e) => setV({ ...v, [l.id]: Number(e.target.value) })}
            />
          </label>
        ))}

        <div className="due">
          <button className="bottone chiaro piccolo"
            onClick={() => setV({ ...v, giro: (v.giro + 90) % 360 })}>
            ⟳ Gira
          </button>
          <button className="bottone arancio piccolo" onClick={salva} disabled={!cambiato || salvo}>
            {salvo ? 'Salvo…' : 'Salva la foto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Rifa' la foto con le correzioni applicate davvero, non solo a schermo.
function disegna (url, v, filtro) {
  return new Promise((risolvi, rifiuta) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => rifiuta(new Error('Non riesco a rileggere la foto. Riprova con il campo migliore.'))
    img.onload = () => {
      const dritta = v.giro % 180 === 0
      const tela = document.createElement('canvas')
      tela.width = dritta ? img.width : img.height
      tela.height = dritta ? img.height : img.width

      const ctx = tela.getContext('2d')
      ctx.translate(tela.width / 2, tela.height / 2)
      ctx.rotate((v.giro * Math.PI) / 180)
      ctx.filter = filtro
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      tela.toBlob(
        (blob) => blob
          ? risolvi({ blob, larghezza: tela.width, altezza: tela.height })
          : rifiuta(new Error('Non riesco a salvare la foto corretta.')),
        'image/jpeg',
        0.9
      )
    }
    img.src = url
  })
}
