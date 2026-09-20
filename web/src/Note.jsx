import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { quando } from './utili.js'

// Il blocco note e' personale: le cose da ricordare che non stanno su un
// lavoro in particolare. Non lo vede nessun altro, nemmeno l'admin.
export default function Note ({ indietro }) {
  const [note, setNote] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState('')
  const [testo, setTesto] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [inModifica, setInModifica] = useState(null)  // { id, testo }

  const campo = useRef(null)

  const segnala = (e) => { if (!e?.linea) setErrore(e.message) }
  const ricarica = () => api.note().then(setNote).catch(segnala).finally(() => setCaricando(false))

  useEffect(() => { ricarica() }, [])

  async function aggiungi (e) {
    e.preventDefault()
    const pulito = testo.trim()
    if (!pulito || salvo) return
    setSalvo(true)
    setErrore('')
    try {
      const nuova = await api.creaNota(pulito)
      setNote((n) => [nuova, ...n])
      setTesto('')
      campo.current?.focus()
    } catch (err) { setErrore(err.message) } finally { setSalvo(false) }
  }

  async function segna (nota) {
    // La spunta si muove subito: aspettare il server sembrerebbe rotto.
    setNote((n) => n.map((x) => (x.id === nota.id ? { ...x, fatta: !nota.fatta } : x)))
    try {
      await api.cambiaNota(nota.id, { fatta: !nota.fatta })
      ricarica()
    } catch (e) { segnala(e); ricarica() }
  }

  async function salvaModifica () {
    const pulito = (inModifica.testo || '').trim()
    if (!pulito) return setInModifica(null)
    try {
      const nuova = await api.cambiaNota(inModifica.id, { testo: pulito })
      setNote((n) => n.map((x) => (x.id === nuova.id ? nuova : x)))
    } catch (e) { setErrore(e.message) }
    setInModifica(null)
  }

  async function elimina (nota) {
    if (!confirm('Elimino questa nota?')) return
    setNote((n) => n.filter((x) => x.id !== nota.id))
    try { await api.eliminaNota(nota.id) } catch (e) { segnala(e); ricarica() }
  }

  async function togliFatte () {
    if (!confirm('Tolgo tutte le note gia’ fatte?')) return
    try {
      await api.togliNoteFatte()
      ricarica()
    } catch (e) { setErrore(e.message) }
  }

  const daFare = note.filter((n) => !n.fatta)
  const fatte = note.filter((n) => n.fatta)

  const riga = (n) => (
    <li key={n.id} className={n.fatta ? 'fatta' : ''}>
      <button className="spunta" onClick={() => segna(n)} aria-pressed={n.fatta}
        aria-label={n.fatta ? 'Rimetti da fare' : 'Segna come fatta'}>
        {n.fatta ? '✓' : ''}
      </button>

      <div className="corpo">
        {inModifica?.id === n.id
          ? (
            <form className="nuova-nota" onSubmit={(e) => { e.preventDefault(); salvaModifica() }}>
              <input
                autoFocus value={inModifica.testo} maxLength={2000}
                onChange={(e) => setInModifica({ ...inModifica, testo: e.target.value })}
              />
              <button className="bottone arancio piccolo" type="submit">Salva</button>
            </form>
            )
          : (
            <>
              <span onClick={() => setInModifica({ id: n.id, testo: n.testo })}>{n.testo}</span>
              <small>{quando(n.creata_il)}</small>
            </>
            )}
      </div>

      {inModifica?.id !== n.id && (
        <button className="togli" onClick={() => elimina(n)} aria-label="Elimina la nota">✕</button>
      )}
    </li>
  )

  return (
    <>
      <header className="testata">
        <button className="indietro" onClick={indietro} aria-label="Indietro">‹</button>
        <h1>
          Blocco note
          <span className="sotto">Solo tuo: non lo vede nessun altro</span>
        </h1>
      </header>

      <div className="contenuto">
        {errore && <div className="errore">{errore}</div>}

        {caricando
          ? <div className="vuoto">Apro il blocco note…</div>
          : note.length === 0
            ? (
              <div className="vuoto">
                <p style={{ fontSize: 40, margin: 0 }}>📝</p>
                <p>Ancora niente scritto.</p>
                <p className="riga-vuota">
                  Qui tieni le tue cose: cosa comprare, chi richiamare, i viaggi da segnare.
                  Restano sul tuo account e le vedi da qualsiasi telefono.
                </p>
              </div>
              )
            : (
              <>
                <div className="carta">
                  {daFare.length === 0
                    ? <p className="riga-vuota" style={{ margin: 2 }}>Tutto fatto, non resta niente.</p>
                    : <ul className="note senza-bordo">{daFare.map(riga)}</ul>}
                </div>

                {fatte.length > 0 && (
                  <>
                    <h2 className="titolo-sezione">Fatte ({fatte.length})</h2>
                    <div className="carta">
                      <ul className="note senza-bordo">{fatte.map(riga)}</ul>
                      <button className="bottone chiaro piccolo" style={{ marginTop: 10 }} onClick={togliFatte}>
                        Togli quelle fatte
                      </button>
                    </div>
                  </>
                )}
              </>
              )}
      </div>

      <div className="barra-azione">
        <form className="nuova-nota" onSubmit={aggiungi}>
          <input
            ref={campo} value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={2000}
            placeholder="Comprare le viti da 4×40…"
          />
          <button className="bottone arancio" type="submit" disabled={!testo.trim() || salvo}>
            Aggiungi
          </button>
        </form>
      </div>
    </>
  )
}
