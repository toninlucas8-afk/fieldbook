import { useEffect, useState } from 'react'
import { taDum } from './suono.js'

// La scritta all'apertura, come quella dei film. Dura meno di due secondi
// e si salta toccando lo schermo: in cantiere nessuno vuole aspettare.
export default function Intro ({ fine }) {
  const [via, setVia] = useState(false)

  const corta = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!corta) taDum()
    const t = setTimeout(() => { setVia(true); setTimeout(fine, 260) }, corta ? 500 : 1900)
    return () => clearTimeout(t)
  }, [fine, corta])

  const salta = () => { setVia(true); setTimeout(fine, 200) }

  return (
    <div className={`intro ${via ? 'via' : ''} ${corta ? 'corta' : ''}`} onClick={salta}>
      <div className="dentro">
        <img className="bestia" src="/icona.svg" alt="" />
        <div className="parola">
          SILCOM
          <span className="luce" aria-hidden="true" />
        </div>
        <div className="riga" />
      </div>
    </div>
  )
}
