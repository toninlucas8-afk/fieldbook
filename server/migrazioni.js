// Aggiunte allo schema che devono arrivare da sole quando l'app si aggiorna,
// senza che nessuno debba incollare SQL a mano da qualche parte.
// Ogni istruzione qui deve poter girare piu' volte senza fare danni.
import { q } from './db.js'

const PASSI = [
  {
    nome: 'annotazioni del lavoro',
    sql: `
      create table if not exists annotazioni (
        id        uuid primary key default gen_random_uuid(),
        lavoro_id uuid not null references lavori(id) on delete cascade,
        testo     text not null,
        fatta     boolean not null default false,
        creata_da uuid references utenti(id) on delete set null,
        creata_il timestamptz not null default now(),
        chiusa_da uuid references utenti(id) on delete set null,
        chiusa_il timestamptz
      );
      create index if not exists annotazioni_lavoro_idx
        on annotazioni (lavoro_id, fatta, creata_il desc);
    `
  }
]

export async function applicaMigrazioni () {
  for (const passo of PASSI) {
    try {
      await q(passo.sql)
    } catch (e) {
      console.error(`Migrazione "${passo.nome}" fallita:`, e.message)
      throw e
    }
  }
  console.log(`Schema aggiornato (${PASSI.length} controlli).`)
}
