// La pagina che vede l'azienda committente aprendo il link: niente account,
// niente app da installare, e si stampa o si salva in PDF dal browser.
// La costruisce il server a ogni apertura, cosi' i link delle foto sono
// sempre freschi (quelli di R2 scadono dopo un'ora).

const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;')

const dataLunga = (iso) => {
  if (!iso) return null
  const [a, m, g] = iso.split('-').map(Number)
  return new Date(a, m - 1, g).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

const quandoFirma = (d) =>
  new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

export function paginaResoconto ({ lavoro, foto, firme, daFare }) {
  const cliente = [lavoro.cliente_nome, lavoro.cliente_cognome].filter(Boolean).join(' ')
  const giorno = dataLunga(lavoro.data_lavoro)

  const righe = [
    cliente && ['Cliente', cliente],
    lavoro.indirizzo && ['Indirizzo', lavoro.indirizzo],
    giorno && ['Giorno', giorno + (lavoro.ora_lavoro ? `, ore ${lavoro.ora_lavoro}` : '')],
    ['Stato', lavoro.stato === 'concluso' ? 'Concluso' : 'In corso']
  ].filter(Boolean)

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(lavoro.titolo)} - Fieldbook</title>
<style>
  :root { --scuro:#14243a; --arancio:#f4a63a; --tenue:#64748b; --bordo:#dfe5ee; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f3f5f8; color:#16202e;
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { background:var(--scuro); color:#fff; padding:26px 20px; }
  .dentro { max-width:960px; margin:0 auto; }
  header h1 { margin:0 0 4px; font-size:24px; }
  header p { margin:0; opacity:.75; }
  main { padding:22px 20px 60px; }
  .scheda { background:#fff; border:1px solid var(--bordo); border-radius:14px; padding:18px; margin-bottom:18px; }
  h2 { font-size:17px; margin:26px 0 12px; }
  table { border-collapse:collapse; width:100%; }
  td { padding:7px 0; vertical-align:top; }
  td:first-child { color:var(--tenue); width:150px; }
  .foto { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; }
  .foto a { display:block; }
  .foto img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; display:block; background:#e7ebf1; }
  .foto figure { margin:0; }
  .foto figcaption { font-size:12.5px; color:var(--tenue); margin-top:4px; }
  ul { margin:0; padding-left:20px; }
  li { margin-bottom:6px; }
  .firma img { max-width:320px; width:100%; background:#fff; border:1px solid var(--bordo); border-radius:10px; }
  .firma p { color:var(--tenue); font-size:14px; margin:8px 0 0; }
  .stampa { background:var(--arancio); color:#1b1200; border:0; border-radius:12px;
            padding:13px 20px; font-size:15px; font-weight:600; cursor:pointer; }
  footer { color:var(--tenue); font-size:13px; text-align:center; padding:0 20px 40px; }
  @media print {
    body { background:#fff; }
    header { background:#fff; color:#000; border-bottom:2px solid #000; padding:0 0 12px; }
    .stampa, footer { display:none; }
    .foto { grid-template-columns:repeat(3,1fr); }
    .scheda { border:0; padding:0; }
  }
</style>
</head>
<body>
  <header><div class="dentro">
    <h1>${esc(lavoro.titolo)}</h1>
    <p>${esc(lavoro.azienda_nome || 'Resoconto del lavoro')}</p>
  </div></header>

  <main class="dentro">
    <div class="scheda">
      <table>${righe.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    </div>

    ${daFare.length
      ? `<h2>Da sistemare</h2>
         <div class="scheda"><ul>${daFare.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`
      : ''}

    <h2>Foto del lavoro (${foto.length})</h2>
    ${foto.length
      ? `<div class="foto">${foto.map((f) => `
          <figure>
            <a href="${esc(f.piena)}" target="_blank" rel="noreferrer">
              <img src="${esc(f.mini)}" alt="${esc(f.didascalia || '')}" loading="lazy">
            </a>
            ${f.didascalia ? `<figcaption>${esc(f.didascalia)}</figcaption>` : ''}
          </figure>`).join('')}</div>`
      : '<div class="scheda">Nessuna foto.</div>'}

    ${firme.length
      ? `<h2>Firma del cliente</h2>
         ${firme.map((f) => `
           <div class="scheda firma">
             <img src="${esc(f.url)}" alt="Firma">
             <p>${esc(f.nome_cliente || 'Cliente')} - ${esc(quandoFirma(f.firmata_il))}${f.nota ? ` - ${esc(f.nota)}` : ''}</p>
           </div>`).join('')}`
      : ''}

    <button class="stampa" onclick="window.print()">Stampa o salva in PDF</button>
  </main>

  <footer>Pagina generata da Fieldbook. Il link scade automaticamente.</footer>
</body>
</html>`
}

export const paginaScaduta = () => `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Link non piu' valido</title></head>
<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;
             background:#f3f5f8;color:#16202e;font:17px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;
             text-align:center;padding:24px">
  <div>
    <h1 style="font-size:22px;margin:0 0 8px">Questo link non e' piu' valido</h1>
    <p style="color:#64748b;margin:0">E' scaduto o e' stato annullato. Chiedine uno nuovo a chi te lo ha mandato.</p>
  </div>
</body></html>`
