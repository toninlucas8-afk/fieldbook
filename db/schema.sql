-- Fieldbook - schema del database (Supabase / PostgreSQL)
-- Nomi in italiano: il progetto e' letto e mantenuto in italiano.

create extension if not exists "pgcrypto";

-- Chi puo' entrare nell'app. Nessuna email, nessuna registrazione:
-- l'amministratore crea la persona e le consegna un PIN.
create table utenti (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  nome_norm     text not null unique,          -- nome normalizzato, per il login
  ruolo         text not null default 'montatore' check (ruolo in ('admin','montatore')),
  pin_hash      text not null,                 -- bcrypt: il PIN in chiaro non viene mai salvato
  pin_cambiato_il timestamptz not null default now(),
  attivo        boolean not null default true, -- false = accesso revocato, foto e storico restano
  tentativi_falliti int not null default 0,
  bloccato_fino timestamptz,                   -- anti tentativi a raffica
  creato_il     timestamptz not null default now(),
  ultimo_accesso timestamptz
);

-- Un telefono che ha gia' fatto il login: evita di ridigitare il PIN ogni giorno.
create table sessioni (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null references utenti(id) on delete cascade,
  token_hash   text not null unique,           -- in chiaro sta solo nel cookie del telefono
  dispositivo  text,                           -- etichetta leggibile, per riconoscerlo nella lista
  creata_il    timestamptz not null default now(),
  ultimo_uso   timestamptz not null default now(),
  scade_il     timestamptz not null
);
create index on sessioni (utente_id);

-- Le aziende committenti (per ora 4/5).
create table aziende (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  colore    text,                              -- per distinguerle a colpo d'occhio nella lista
  note      text,
  attiva    boolean not null default true,
  creata_il timestamptz not null default now()
);

-- Il lavoro: e' l'unita' attorno a cui gira tutto.
create table lavori (
  id             uuid primary key default gen_random_uuid(),
  titolo         text not null,
  azienda_id     uuid references aziende(id) on delete set null,
  cliente_nome   text,
  cliente_cognome text,
  cliente_telefono text,
  indirizzo      text,
  note           text,
  stato          text not null default 'in_corso' check (stato in ('in_corso','concluso')),
  data_lavoro    date,                          -- giorno del montaggio, per l'agenda
  ora_lavoro     time,                          -- ora dell'appuntamento, se c'e'
  copertina_foto_id uuid,                      -- FK aggiunta dopo, foto referenzia lavori
  creato_da      uuid references utenti(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  concluso_il    timestamptz
);
create index on lavori (stato, aggiornato_il desc);
create index on lavori (azienda_id);
create index on lavori (data_lavoro);

-- Chi va a fare il montaggio: una riga per persona.
create table assegnazioni (
  lavoro_id    uuid not null references lavori(id) on delete cascade,
  utente_id    uuid not null references utenti(id) on delete cascade,
  assegnato_da uuid references utenti(id) on delete set null,
  assegnato_il timestamptz not null default now(),
  primary key (lavoro_id, utente_id)
);
create index on assegnazioni (utente_id);

-- Le foto stanno su Cloudflare R2: qui teniamo solo il riferimento.
create table foto (
  id            uuid primary key default gen_random_uuid(),
  lavoro_id     uuid not null references lavori(id) on delete cascade,
  chiave        text not null unique,          -- oggetto a piena qualita' su R2
  chiave_mini   text,                          -- miniatura, per non consumare i giga in cantiere
  didascalia    text,
  larghezza     int,
  altezza       int,
  byte          bigint,
  scattata_il   timestamptz,                   -- data dagli EXIF, quando c'e'
  caricata_da   uuid references utenti(id) on delete set null,
  caricata_il   timestamptz not null default now()
);
create index on foto (lavoro_id, caricata_il desc);

alter table lavori
  add constraint lavori_copertina_fk
  foreign key (copertina_foto_id) references foto(id) on delete set null;

-- Documenti del lavoro (bolle, conferme d'ordine, schede di montaggio).
create table documenti (
  id           uuid primary key default gen_random_uuid(),
  lavoro_id    uuid not null references lavori(id) on delete cascade,
  chiave       text not null unique,
  nome_file    text not null,
  tipo_mime    text,
  byte         bigint,
  caricato_da  uuid references utenti(id) on delete set null,
  caricato_il  timestamptz not null default now()
);
create index on documenti (lavoro_id, caricato_il desc);

-- Coda degli aggiornamenti: e' quello che fa comparire le foto sugli altri
-- telefoni senza che nessuno debba aggiornare la pagina.
create table eventi (
  id        bigserial primary key,
  lavoro_id uuid references lavori(id) on delete cascade,
  tipo      text not null,                     -- foto_aggiunta, lavoro_creato, lavoro_concluso, ...
  payload   jsonb not null default '{}'::jsonb,
  utente_id uuid references utenti(id) on delete set null,
  creato_il timestamptz not null default now()
);
create index on eventi (id desc);
create index on eventi (lavoro_id, id desc);

-- Annotazioni del lavoro: cose mancanti, pezzi da ordinare, promemoria.
-- Chiunque puo' aggiungerne e spuntarle quando sono risolte.
create table annotazioni (
  id            uuid primary key default gen_random_uuid(),
  lavoro_id     uuid not null references lavori(id) on delete cascade,
  testo         text not null,
  fatta         boolean not null default false,
  creata_da     uuid references utenti(id) on delete set null,
  creata_il     timestamptz not null default now(),
  chiusa_da     uuid references utenti(id) on delete set null,
  chiusa_il     timestamptz
);
create index on annotazioni (lavoro_id, fatta, creata_il desc);

-- Impostazioni interne del server (per ora le chiavi degli avvisi, che il
-- server genera da solo al primo avvio).
create table impostazioni (
  chiave        text primary key,
  valore        jsonb not null,
  aggiornata_il timestamptz not null default now()
);

-- Un telefono che ha acceso gli avvisi.
create table iscrizioni_push (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null references utenti(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  dispositivo  text,
  creata_il    timestamptz not null default now(),
  ultimo_invio timestamptz
);
create index on iscrizioni_push (utente_id);

-- La firma che il cliente mette sullo schermo a fine montaggio.
create table firme (
  id           uuid primary key default gen_random_uuid(),
  lavoro_id    uuid not null references lavori(id) on delete cascade,
  chiave       text not null unique,          -- immagine della firma su R2
  nome_cliente text,
  nota         text,
  raccolta_da  uuid references utenti(id) on delete set null,
  firmata_il   timestamptz not null default now()
);
create index on firme (lavoro_id, firmata_il desc);

-- Il link con foto e firma da mandare all'azienda committente, che non
-- ha un account e non deve installare niente.
create table condivisioni (
  id        uuid primary key default gen_random_uuid(),
  lavoro_id uuid not null references lavori(id) on delete cascade,
  token     text not null unique,             -- sta nell'indirizzo del link
  creata_da uuid references utenti(id) on delete set null,
  creata_il timestamptz not null default now(),
  scade_il  timestamptz not null,
  aperture  int not null default 0,
  ultima_apertura timestamptz
);
create index on condivisioni (lavoro_id, creata_il desc);
