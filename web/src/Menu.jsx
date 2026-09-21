import { useEffect, useState } from 'react'
import { accendiAvvisi, api, avvisiAttivi, avvisiPossibili, spegniAvvisi } from './api.js'

// Il foglio che sale dal basso toccando i tre puntini: le cose che
// riguardano te e questo telefono, non i lavori.
export default function Menu ({ utente, chiudi, apriNote, apriSquadra, esci }) {
  return (
    <div className="foglio-sfondo" onClick={chiudi}>
      <div className="foglio" onClick={(e) => e.stopPropagation()}>
        <h2>{utente.nome}</h2>
        <Avvisi />
        <button className="bottone chiaro" style={{ marginBottom: 10 }} onClick={() => { chiudi(); apriNote() }}>
          📝 Il mio blocco note
        </button>
        {utente.ruolo === 'admin' && (
          <button className="bottone chiaro" style={{ marginBottom: 10 }} onClick={() => { chiudi(); apriSquadra() }}>
            👷 Squadra
          </button>
        )}
        <button className="bottone chiaro" style={{ marginBottom: 10 }} onClick={() => { chiudi(); apriSquadra('mio-pin') }}>
          Cambia il mio PIN
        </button>
        <button className="bottone pericolo" onClick={esci}>Esci da questo telefono</button>
      </div>
    </div>
  )
}

// Gli avvisi si accendono su ogni telefono separatamente: e' il telefono
// che si iscrive, non la persona.
function Avvisi () {
  const [stato, setStato] = useState('controllo')
  const [messaggio, setMessaggio] = useState('')
  const [attesa, setAttesa] = useState(false)

  useEffect(() => {
    if (!avvisiPossibili()) return setStato('impossibili')
    avvisiAttivi().then((si) => setStato(si ? 'accesi' : 'spenti')).catch(() => setStato('spenti'))
  }, [])

  async function accendi () {
    setAttesa(true); setMessaggio('')
    try {
      await accendiAvvisi()
      setStato('accesi')
      setMessaggio('Avvisi accesi su questo telefono.')
    } catch (e) { setMessaggio(e.message) } finally { setAttesa(false) }
  }

  async function prova () {
    setAttesa(true); setMessaggio('')
    try {
      const esito = await api.provaAvvisi()
      setMessaggio(esito.inviati > 0 ? 'Avviso di prova mandato.' : 'Nessun telefono iscritto: prova a riaccenderli.')
    } catch (e) { setMessaggio(e.message) } finally { setAttesa(false) }
  }

  async function spegni () {
    setAttesa(true); setMessaggio('')
    try {
      await spegniAvvisi()
      setStato('spenti')
      setMessaggio('Avvisi spenti su questo telefono.')
    } catch (e) { setMessaggio(e.message) } finally { setAttesa(false) }
  }

  if (stato === 'controllo') return null
  if (stato === 'impossibili') {
    return <p className="riga-vuota">Questo telefono non sa mostrare gli avvisi.</p>
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {stato === 'spenti'
        ? (
          <button className="bottone chiaro" onClick={accendi} disabled={attesa}>
            🔔 Attiva gli avvisi su questo telefono
          </button>
          )
        : (
          <div className="due">
            <button className="bottone chiaro piccolo" onClick={prova} disabled={attesa}>Mandami una prova</button>
            <button className="bottone chiaro piccolo" onClick={spegni} disabled={attesa}>Spegni gli avvisi</button>
          </div>
          )}
      {messaggio && <small style={{ display: 'block', marginTop: 8, color: 'var(--testo-tenue)' }}>{messaggio}</small>}
    </div>
  )
}
