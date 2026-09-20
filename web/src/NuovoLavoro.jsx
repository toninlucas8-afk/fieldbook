import { useEffect, useState } from 'react'
import { api } from './api.js'
import { giornoISO, iniziali } from './utili.js'

export default function NuovoLavoro ({ utente, indietro, quandoCreato }) {
  const [aziende, setAziende] = useState([])
  const [colleghi, setColleghi] = useState([])
  const [squadra, setSquadra] = useState(() => new Set([utente.id]))
  const [dati, setDati] = useState({
    titolo: '', azienda_id: '', cliente_nome: '', cliente_cognome: '',
    cliente_telefono: '', indirizzo: '', note: '', data_lavoro: '', ora_lavoro: ''
  })
  const [nuovaAzienda, setNuovaAzienda] = useState('')
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)

  useEffect(() => {
    api.aziende().then(setAziende).catch(() => {})
    api.colleghi().then(setColleghi).catch(() => {})
  }, [])

  const cambiaSquadra = (id) => setSquadra((s) => {
    const nuova = new Set(s)
    if (nuova.has(id)) nuova.delete(id); else nuova.add(id)
    return nuova
  })

  const cambia = (campo) => (e) => setDati((d) => ({ ...d, [campo]: e.target.value }))

  async function aggiungiAzienda () {
    if (!nuovaAzienda.trim()) return
    try {
      const a = await api.creaAzienda({ nome: nuovaAzienda.trim() })
      setAziende((v) => [...v, a])
      setDati((d) => ({ ...d, azienda_id: a.id }))
      setNuovaAzienda('')
    } catch (e) { setErrore(e.message) }
  }

  async function invia (e) {
    e.preventDefault()
    setErrore('')
    setAttesa(true)
    try {
      const lavoro = await api.creaLavoro({
        ...dati,
        azienda_id: dati.azienda_id || null,
        data_lavoro: dati.data_lavoro || null,
        ora_lavoro: dati.data_lavoro ? (dati.ora_lavoro || null) : null,
        assegnati: [...squadra]
      })
      quandoCreato(lavoro.id)
    } catch (err) {
      setErrore(err.message)
      setAttesa(false)
    }
  }

  return (
    <>
      <header className="testata">
        <button className="indietro" onClick={indietro} aria-label="Indietro">‹</button>
        <h1>Nuovo lavoro</h1>
      </header>

      <form className="contenuto" onSubmit={invia}>
        {errore && <div className="errore">{errore}</div>}

        <div className="carta">
          <div className="campo">
            <label htmlFor="titolo">Che lavoro è</label>
            <input id="titolo" value={dati.titolo} onChange={cambia('titolo')}
              placeholder="Cucina Stosa, montaggio" required autoFocus />
          </div>

          <div className="campo">
            <label htmlFor="azienda">Azienda committente</label>
            <select id="azienda" value={dati.azienda_id} onChange={cambia('azienda_id')}>
              <option value="">Nessuna</option>
              {aziende.filter((a) => a.attiva).map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          {utente.ruolo === 'admin' && (
            <div className="due">
              <input value={nuovaAzienda} onChange={(e) => setNuovaAzienda(e.target.value)}
                placeholder="Aggiungi un'azienda" style={{ minHeight: 46, padding: '10px 13px', border: '1px solid var(--bordo)', borderRadius: 11 }} />
              <button type="button" className="bottone chiaro piccolo" onClick={aggiungiAzienda}>Aggiungi</button>
            </div>
          )}
        </div>

        <div className="carta">
          <div className="due">
            <div className="campo">
              <label htmlFor="n">Nome cliente</label>
              <input id="n" value={dati.cliente_nome} onChange={cambia('cliente_nome')} />
            </div>
            <div className="campo">
              <label htmlFor="c">Cognome</label>
              <input id="c" value={dati.cliente_cognome} onChange={cambia('cliente_cognome')} />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="tel">Telefono del cliente</label>
            <input id="tel" type="tel" inputMode="tel" value={dati.cliente_telefono} onChange={cambia('cliente_telefono')} />
          </div>

          <div className="campo">
            <label htmlFor="ind">Indirizzo</label>
            <input id="ind" value={dati.indirizzo} onChange={cambia('indirizzo')}
              placeholder="Via, numero, città" />
          </div>
        </div>

        <div className="carta">
          <div className="quando-chi">
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="giorno">Quando</label>
              <input id="giorno" type="date" min={giornoISO(new Date(Date.now() - 86400000 * 365))}
                value={dati.data_lavoro} onChange={cambia('data_lavoro')} />
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="orario">Ora</label>
              <input id="orario" type="time" value={dati.ora_lavoro}
                onChange={cambia('ora_lavoro')} disabled={!dati.data_lavoro} />
            </div>
          </div>

          <label className="titolo-campo">Chi ci va</label>
          <div className="chi-ci-va">
            {colleghi.map((p) => (
              <button type="button" key={p.id} className="pillola" aria-pressed={squadra.has(p.id)}
                onClick={() => cambiaSquadra(p.id)}>
                <span className="cerchietto">{iniziali(p.nome)}</span>
                {p.nome.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="carta">
          <div className="campo" style={{ marginBottom: 0 }}>
            <label htmlFor="note">Note per la squadra</label>
            <textarea id="note" value={dati.note} onChange={cambia('note')}
              placeholder="Piano, ascensore, orari, cosa ritirare in magazzino…" />
          </div>
        </div>

        <button className="bottone arancio" disabled={attesa || !dati.titolo.trim()}>
          {attesa ? 'Creo…' : 'Crea il lavoro'}
        </button>
      </form>
    </>
  )
}
