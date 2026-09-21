// Il vecchio con i baffi bianchi. Esce dal basso dello schermo, dice la sua
// e se ne torna giù. E' disegnato a quadretti, uno per uno, come i giochi
// di una volta: niente immagini da scaricare.

const COLORI = {
  p: '#e9b98c',   // pelle
  n: '#d79c6b',   // naso
  w: '#f3f6f9',   // capelli e baffi
  o: '#23293a',   // occhi
  c: '#3d6da8',   // camicia da lavoro
  b: '#26405f',   // bretelle
  m: '#9c5f4c'    // bocca
}

const OMINO = [
  '................',
  '.....pppppp.....',
  '....pppppppp....',
  '...pppppppppp...',
  '..wppppppppppw..',
  '..wpwwwppwwwpw..',
  '..wppoppppoppw..',
  '..wppppnnppppw..',
  '..wpwwwwwwwwpw..',
  '...wwwpmmpwww...',
  '....pppppppp....',
  '.......pp.......',
  '...cccccccccc...',
  '..pcccbccbcccp..',
  '..pcccbccbcccp..',
  '..pcccbccbcccp..',
  '...cccbccbccc...',
  '...cccbccbccc...'
]

export default function Vecchio ({ battuta }) {
  const quadretti = []
  OMINO.forEach((riga, y) => {
    riga.split('').forEach((ch, x) => {
      if (COLORI[ch]) quadretti.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORI[ch]} />)
    })
  })

  return (
    <div className={`vecchio ${battuta ? 'su' : ''} ${battuta?.tono === 'boss' ? 'boss' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 16 18" width="76" height="86" shapeRendering="crispEdges">{quadretti}</svg>
      <p className="fumetto">{battuta?.testo}</p>
    </div>
  )
}
