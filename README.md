# Fieldbook

App di cantiere per la squadra: ogni lavoro ha le sue foto, i suoi documenti,
l'indirizzo, il cliente e l'azienda committente. Quando uno carica una foto,
sugli altri telefoni compare da sola, senza aggiornare niente.

Si installa sul telefono dal browser (Android e iPhone), senza passare da
nessuno store.

## Com'è fatta

| Pezzo | Dove sta | Perché |
|---|---|---|
| Foto e documenti | Cloudflare R2 | 10 GB gratis, scaricare non costa niente |
| Dati dei lavori | Supabase (PostgreSQL) | gratis e non scade |
| App e server | Render | gratis, tiene le chiavi di R2 al sicuro |

Le foto vanno dal telefono a Cloudflare **senza passare dal server**: è più
veloce in cantiere e non consuma la banda di Render. Il server si limita a
firmare il permesso di caricare, che dura 15 minuti.

## Cosa serve prima

Tre account, tutti gratuiti: Cloudflare, Supabase, Render.

### 1. Supabase, per i dati

1. Crea un progetto nuovo, regione Frankfurt.
2. Apri **SQL Editor**, incolla tutto il contenuto di `db/schema.sql` e premi Run.
3. Vai su **Project settings → Database → Connection string → URI**, copia
   l'indirizzo e sostituisci `[YOUR-PASSWORD]` con la password del progetto.
   Ti servirà come `DATABASE_URL`.

> Il piano gratuito mette il progetto in pausa dopo una settimana senza usarlo.
> Lavorandoci ogni giorno non succede; se capita, si riattiva con un click.

### 2. Cloudflare R2, per le foto

1. Crea un bucket chiamato `fieldbook`.
2. **Manage API tokens → Create API token**, permessi *Object Read & Write*
   sul bucket. Segnati Access Key ID e Secret Access Key: il secret si vede
   una volta sola.
3. Nelle impostazioni del bucket, alla voce **CORS**, incolla il contenuto di
   `db/cors-r2.json` mettendo l'indirizzo vero dell'app al posto del
   segnaposto. **Senza questo passaggio i caricamenti falliscono**: è il
   browser che si rifiuta di mandare il file.

### 3. Render, per l'app

1. **New → Web Service**, collega questo repository.
2. Build command `npm install && npm run build`, start command `npm start`.
3. Nelle **Environment Variables** metti quelle elencate in `.env.example`.
4. Dopo il primo avvio entra con `ADMIN_NOME` e `ADMIN_PIN`, **cambia subito
   il PIN dall'app** e togli `ADMIN_PIN` dalle variabili.

## Come si usa

**Chi comanda.** L'amministratore ha in più la sezione **Squadra**: crea le
persone, sceglie o fa generare il PIN, lo manda su WhatsApp con un tocco,
revoca l'accesso a chi se ne va e rigenera un PIN se gira troppo.

**I PIN.** Sono salvati cifrati: dopo la creazione non sono più leggibili da
nessuno, amministratore compreso. Se un PIN si perde se ne genera uno nuovo.
Dopo 5 tentativi sbagliati quel nome si blocca per 10 minuti.

**I telefoni.** Il PIN si digita solo la prima volta. Poi il telefono resta
riconosciuto per sei mesi. Cambiare un PIN o revocare l'accesso scollega
subito tutti i telefoni di quella persona.

**Installare l'app.** Si apre l'indirizzo col browser e si sceglie "Aggiungi
alla schermata Home" (iPhone, da Safari) o "Installa app" (Android, da Chrome).

## Per lavorarci sopra

```bash
npm install              # dipendenze del server
npm --prefix web install # dipendenze dell'app
cp .env.example .env     # e riempilo

npm run dev              # server sulla porta 3000
npm --prefix web run dev # app sulla 5173, con ricarica automatica
```

## Dove sta cosa

```
db/schema.sql      le tabelle del database
db/cors-r2.json    il permesso da dare al bucket Cloudflare
server/auth.js     login con PIN, sessioni, blocco dei tentativi
server/api.js      tutti gli indirizzi dell'API
server/r2.js       i permessi firmati per caricare e vedere le foto
server/eventi.js   gli aggiornamenti dal vivo verso i telefoni
web/src/           l'app che gira sul telefono
```
