// Le battute del vecchio. Sono scritte come parla uno che in cantiere ci ha
// passato quarant'anni: prende in giro, ma alla fine ti vuole bene.

export const BATTUTE = [
  'Occhio al muro, eh. Dico per te.',
  'Ai miei tempi il serpente si mangiava, non si guidava.',
  'Tutta questa fatica per una mela.',
  'Io a quest’ora ero già al bar.',
  'Attento che i muri non si spostano da soli.',
  'Piano con quel dito, che poi si consuma.',
  'Bravo. Adesso però non montarti la testa.',
  'Mia moglie gioca meglio, e non vede niente.',
  'Respira. Sei tu che comandi il serpente, non lui.',
  'Guarda che l’armadio da montare è ancora lì.',
  'Se cadi adesso non ti aiuto, sappilo.',
  'Non male. Ma nemmeno bene, sia chiaro.'
]

// Quando si passa una certa soglia, il vecchio cambia tono.
export const SOGLIE = [
  { punti: 10, testo: 'Dieci punti. Il minimo sindacale, ma ci siamo.' },
  { punti: 25, testo: 'Ehi. Qui si comincia a ragionare.' },
  { punti: 45, testo: 'Ok, adesso mi stai impressionando. E non succede spesso.' },
  { punti: 70, testo: 'Fermi tutti, è passato il capo. Mi levo il cappello.' }
]

// La frecciata di fine partita, che cambia con quanto hai fatto.
const FINALI = [
  {
    fino: 0,
    frasi: [
      'Zero. ZERO. Ma l’hai acceso il telefono?',
      'Hai perso senza mangiare niente. Un record al contrario.',
      'Sei durato meno del caffè alla macchinetta.'
    ]
  },
  {
    fino: 4,
    frasi: [
      'Tutto qui? Mia nipote fa meglio con il gomito.',
      'Bello quel muro, eh? Ci sei andato dritto dritto.',
      'Avevi una mela davanti. Una.'
    ]
  },
  {
    fino: 14,
    frasi: [
      'Dai, ci siamo quasi. Quasi.',
      'Non male per uno che monta armadi. Ma solo per quello.',
      'Ancora un po’ e ti prendo sul serio.'
    ]
  },
  {
    fino: 29,
    frasi: [
      'Ehi, cominci a capirci qualcosa.',
      'Questo era quasi un bel punteggio. Quasi.',
      'Bravo davvero. Non dirlo in giro che l’ho detto io.'
    ]
  },
  {
    fino: 49,
    frasi: [
      'Oh, ma allora sei bravo.',
      'Questo sì che è un punteggio. Complimenti veri.',
      'Comincio a preoccuparmi del mio record.'
    ]
  },
  {
    fino: Infinity,
    frasi: [
      'Levatevi, è passato il capo.',
      'Mi inchino. Comanda pure tu, da oggi.',
      'Sei una bestia. E te lo dice uno che non fa complimenti.'
    ]
  }
]

const a_caso = (lista) => lista[Math.floor(Math.random() * lista.length)]

export const battutaACaso = () => a_caso(BATTUTE)

export function frecciata (punti) {
  const gruppo = FINALI.find((g) => punti <= g.fino)
  return { testo: a_caso(gruppo.frasi), tono: punti >= 45 ? 'boss' : 'normale' }
}
