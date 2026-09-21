// Ognuno si tiene in casa i riquadri che gli servono, nell'ordine che vuole.
export const RIQUADRI = [
  { id: 'oggi', nome: 'La giornata di oggi', dice: 'I lavori di oggi con l’ora e l’indirizzo' },
  { id: 'ritardo', nome: 'Rimasti indietro', dice: 'Avvisa se un lavoro passato non è chiuso' },
  { id: 'numeri', nome: 'I tre numeri', dice: 'Lavori in corso, i tuoi, cose da sistemare' },
  { id: 'prossimi', nome: 'Prossimi giorni', dice: 'I montaggi già in programma' },
  { id: 'note', nome: 'Il blocco note', dice: 'Le prime righe di quello che hai segnato' },
  { id: 'foto', nome: 'Ultime foto', dice: 'Le foto appena caricate dalla squadra' },
  { id: 'snake', nome: '🐍 Snake', dice: 'Il gioco, per quando aspetti il montacarichi' }
]

export default function ScegliRiquadri ({ scelti, snake, chiudi, salva }) {
  const disponibili = RIQUADRI.filter((x) => x.id !== 'snake' || snake)
  const dentro = scelti.map((id) => disponibili.find((x) => x.id === id)).filter(Boolean)
  const fuori = disponibili.filter((x) => !scelti.includes(x.id))

  const sposta = (i, di) => {
    const nuovo = [...scelti]
    const j = i + di
    if (j < 0 || j >= nuovo.length) return
    ;[nuovo[i], nuovo[j]] = [nuovo[j], nuovo[i]]
    salva(nuovo)
  }

  return (
    <div className="foglio-sfondo" onClick={chiudi}>
      <div className="foglio alto" onClick={(e) => e.stopPropagation()}>
        <h2>I riquadri di casa</h2>
        <p className="riga-vuota" style={{ marginTop: 0 }}>
          Scegli cosa vedere aprendo l’app, e in che ordine.
        </p>

        <ul className="scelta-riquadri">
          {dentro.map((x, i) => (
            <li key={x.id}>
              <div className="corpo">
                <strong>{x.nome}</strong>
                <small>{x.dice}</small>
              </div>
              <button className="muovi" onClick={() => sposta(i, -1)} disabled={i === 0} aria-label="Su">▲</button>
              <button className="muovi" onClick={() => sposta(i, 1)} disabled={i === dentro.length - 1} aria-label="Giù">▼</button>
              <button className="togli" onClick={() => salva(scelti.filter((id) => id !== x.id))}
                aria-label={`Togli ${x.nome}`}>✕</button>
            </li>
          ))}
        </ul>

        {fuori.length > 0 && (
          <>
            <label className="titolo-campo">Da aggiungere</label>
            <ul className="scelta-riquadri">
              {fuori.map((x) => (
                <li key={x.id}>
                  <div className="corpo">
                    <strong>{x.nome}</strong>
                    <small>{x.dice}</small>
                  </div>
                  <button className="bottone chiaro piccolo" onClick={() => salva([...scelti, x.id])}>
                    Aggiungi
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button className="bottone arancio" onClick={chiudi}>Fatto</button>
      </div>
    </div>
  )
}
