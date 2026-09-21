// La barra in basso: Casa, Lavori, Note. Sempre a portata di pollice.
const VOCI = [
  { id: 'home', segno: '🏠', nome: 'Casa' },
  { id: 'lavori', segno: '🧰', nome: 'Lavori' },
  { id: 'note', segno: '📝', nome: 'Note' }
]

export default function Barra ({ dove, vaiA }) {
  return (
    <nav className="barra-sotto" aria-label="Sezioni">
      {VOCI.map((v) => (
        <button key={v.id} aria-current={dove === v.id ? 'page' : undefined}
          onClick={() => vaiA(v.id)}>
          <span className="segno" aria-hidden="true">{v.segno}</span>
          {v.nome}
        </button>
      ))}
    </nav>
  )
}
