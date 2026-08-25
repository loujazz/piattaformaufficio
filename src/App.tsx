import { useCallback, useState } from "react";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import { getSpreadsheetMeta, getValues, SheetsApiError } from "./lib/googleSheetsApi";
import "./App.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

const EXPECTED_TABS = ["TimeEntries", "AbsenceEntries", "ExpenseEntries", "LeaveConfig", "ReportTemplate"];

interface ConnectionCheck {
  spreadsheetTitle: string;
  foundTabs: string[];
  timeEntriesHeaders: string[];
}

function App() {
  const missingConfig = !CLIENT_ID || !SPREADSHEET_ID;
  const { status, accessToken, errorMessage, login, logout } = useGoogleAuth(CLIENT_ID);

  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const verifyConnection = useCallback(async () => {
    if (!accessToken) return;
    setChecking(true);
    setCheckError(null);
    try {
      const meta = await getSpreadsheetMeta(accessToken, SPREADSHEET_ID);
      const headers = await getValues(accessToken, SPREADSHEET_ID, "TimeEntries!A1:H1");
      setCheck({
        spreadsheetTitle: meta.title,
        foundTabs: meta.sheetTitles,
        timeEntriesHeaders: headers[0] ?? [],
      });
    } catch (err) {
      const message = err instanceof SheetsApiError ? err.message : "Errore di connessione imprevisto.";
      setCheckError(message);
      setCheck(null);
    } finally {
      setChecking(false);
    }
  }, [accessToken]);

  if (missingConfig) {
    return (
      <main className="app">
        <h1>Presenze Marconi</h1>
        <p className="error">
          Configurazione mancante: crea un file <code>.env</code> partendo da <code>.env.example</code> e imposta{" "}
          <code>VITE_GOOGLE_CLIENT_ID</code> e <code>VITE_SPREADSHEET_ID</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="app">
      <h1>Presenze Marconi</h1>

      {status !== "signed-in" && (
        <section>
          <p>Accedi con il tuo account Google per collegarti al foglio presenze.</p>
          <button onClick={login} disabled={status === "signing-in"}>
            {status === "signing-in" ? "Accesso in corso..." : "Accedi con Google"}
          </button>
          {status === "error" && errorMessage && <p className="error">{errorMessage}</p>}
        </section>
      )}

      {status === "signed-in" && (
        <section>
          <p className="success">Login effettuato.</p>
          <button onClick={logout}>Esci</button>
          <button onClick={verifyConnection} disabled={checking}>
            {checking ? "Verifica in corso..." : "Verifica connessione al foglio"}
          </button>

          {checkError && <p className="error">{checkError}</p>}

          {check && (
            <div className="check-result">
              <p>
                Foglio collegato: <strong>{check.spreadsheetTitle}</strong>
              </p>
              <ul>
                {EXPECTED_TABS.map((tab) => (
                  <li key={tab} className={check.foundTabs.includes(tab) ? "ok" : "missing"}>
                    {check.foundTabs.includes(tab) ? "✅" : "⚠️ mancante —"} {tab}
                  </li>
                ))}
              </ul>
              <p>Intestazioni trovate su TimeEntries: {check.timeEntriesHeaders.join(", ") || "(nessuna)"}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
