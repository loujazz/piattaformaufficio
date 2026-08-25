# Presenze Marconi

App mono-utente (solo Luigi) per registrare presenze, ore lavorate, attività,
trasferte/spese e assenze per il Servizio Marconi TSI (USR Emilia-Romagna).

Nessun backend: il frontend parla direttamente con le Google Sheets API,
autenticandosi via OAuth2 con Google Identity Services. Il Google Sheet
collegato funge da database.

## Stato

**Fase 1 completata**: scaffold del progetto, login Google OAuth, verifica
di collegamento al foglio Google Sheets (tab e intestazioni). Le funzionalità
di registrazione presenze arriveranno nelle fasi successive.

## Setup locale

1. Copia `.env.example` in `.env`:
   ```
   cp .env.example .env
   ```
2. Compila `.env` con:
   - `VITE_GOOGLE_CLIENT_ID`: il Client ID OAuth creato su Google Cloud
     Console (Google Auth Platform → Client → tipo "Applicazione web").
   - `VITE_SPREADSHEET_ID`: l'ID del Google Sheet (dalla URL, tra `/d/` e
     `/edit`).
3. Installa le dipendenze e avvia il dev server:
   ```
   npm install
   npm run dev
   ```
4. Apri `http://localhost:5173`, clicca "Accedi con Google" e poi "Verifica
   connessione al foglio" per confermare che i tab (`TimeEntries`,
   `AbsenceEntries`, `ExpenseEntries`, `LeaveConfig`, `ReportTemplate`) siano
   raggiungibili.

Il foglio Google deve avere questi 5 tab con le intestazioni descritte nella
specifica del progetto (vedi struttura dati).

## Deploy su Vercel

Il progetto è importato su Vercel collegato a questo repository GitHub.

- Variabili d'ambiente da impostare in Project Settings → Environment
  Variables (Production + Preview): `VITE_GOOGLE_CLIENT_ID`,
  `VITE_SPREADSHEET_ID`.
- Ogni push su un branch genera un Preview Deployment con URL dedicato
  (`https://<progetto>-git-<branch>-<team>.vercel.app`).
- L'origine del deployment usato per il login va aggiunta tra le "Origini
  JavaScript autorizzate" del Client OAuth su Google Cloud Console, altrimenti
  il login con Google fallisce.

## Script disponibili

- `npm run dev` — dev server
- `npm run build` — type-check + build di produzione
- `npm run lint` — ESLint
- `npm run preview` — anteprima della build di produzione
