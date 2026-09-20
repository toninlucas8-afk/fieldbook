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
  },
  {
    nome: 'agenda: giorno del montaggio e chi ci va',
    sql: `
      alter table lavori add column if not exists data_lavoro date;
      alter table lavori add column if not exists ora_lavoro time;
      create index if not exists lavori_data_idx on lavori (data_lavoro);

      create table if not exists assegnazioni (
        lavoro_id    uuid not null references lavori(id) on delete cascade,
        utente_id    uuid not null references utenti(id) on delete cascade,
        assegnato_da uuid references utenti(id) on delete set null,
        assegnato_il timestamptz not null default now(),
        primary key (lavoro_id, utente_id)
      );
      create index if not exists assegnazioni_utente_idx on assegnazioni (utente_id);
    `
  },
  {
    nome: 'avvisi sul telefono',
    sql: `
      create table if not exists impostazioni (
        chiave        text primary key,
        valore        jsonb not null,
        aggiornata_il timestamptz not null default now()
      );

      create table if not exists iscrizioni_push (
        id          uuid primary key default gen_random_uuid(),
        utente_id   uuid not null references utenti(id) on delete cascade,
        endpoint    text not null unique,
        p256dh      text not null,
        auth        text not null,
        dispositivo text,
        creata_il   timestamptz not null default now(),
        ultimo_invio timestamptz
      );
      create index if not exists iscrizioni_utente_idx on iscrizioni_push (utente_id);
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
