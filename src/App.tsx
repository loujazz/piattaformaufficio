import { useCallback, useState } from "react";
import { AbsencesView } from "./components/AbsencesView";
import { AssignmentsView } from "./components/AssignmentsView";
import { DailyTimeEntry } from "./components/DailyTimeEntry";
import { ExpensesView } from "./components/ExpensesView";
import { ExportView } from "./components/ExportView";
import { MonthlyView } from "./components/MonthlyView";
import { WeeklyView } from "./components/WeeklyView";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import { useTheme } from "./hooks/useTheme";
import { todayLocalISODate } from "./lib/date";
import { getSpreadsheetMeta, getValues, SheetsApiError } from "./lib/googleSheetsApi";
import "./App.css";

const THEME_ICON = { system: "🌗", light: "☀️", dark: "🌙" } as const;
const THEME_LABEL = { system: "Automatico", light: "Chiaro", dark: "Scuro" } as const;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

const EXPECTED_TABS = ["TimeEntries", "AbsenceEntries", "ExpenseEntries", "LeaveConfig", "ReportTemplate"];

type ViewName = "daily" | "weekly" | "monthly" | "absences" | "expenses" | "assignments" | "export";

interface ConnectionCheck {
  spreadsheetTitle: string;
  foundTabs: string[];
  timeEntriesHeaders: string[];
}

function App() {
  const missingConfig = !CLIENT_ID || !SPREADSHEET_ID;
  const { status, accessToken, userInfo, errorMessage, login, logout } = useGoogleAuth(CLIENT_ID);
  const { theme, cycleTheme } = useTheme();
  const [view, setView] = useState<ViewName>("daily");
  const [dailyDate, setDailyDate] = useState(todayLocalISODate);

  const handleSelectDay = useCallback((iso: string) => {
    setDailyDate(iso);
    setView("daily");
  }, []);

  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const verifyConnection = useCallback(async () => {
    if (!accessToken) return;
    setChecking(true);
    setCheckError(null);
    try {
      const meta = await getSpreadsheetMeta(accessToken, SPREADSHEET_ID);
      const headers = await getValues(accessToken, SPREADSHEET_ID, "TimeEntries!A1:I1");
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

  const themeToggle = (
    <button type="button" className="theme-toggle" onClick={cycleTheme} title={`Tema: ${THEME_LABEL[theme]}`}>
      {THEME_ICON[theme]} {THEME_LABEL[theme]}
    </button>
  );

  if (missingConfig) {
    return (
      <main className="app">
        <header className="app-header">
          <h1>Presenze Marconi</h1>
          <div className="header-actions">{themeToggle}</div>
        </header>
        <p className="error">
          Configurazione mancante: crea un file <code>.env</code> partendo da <code>.env.example</code> e imposta{" "}
          <code>VITE_GOOGLE_CLIENT_ID</code> e <code>VITE_SPREADSHEET_ID</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Presenze Marconi</h1>
        <div className="header-actions">
          {status === "signed-in" && userInfo && (
            <span className="user-badge" title={userInfo.email}>
              {userInfo.picture && <img className="user-avatar" src={userInfo.picture} alt="" referrerPolicy="no-referrer" />}
              <span className="user-name">{userInfo.name}</span>
            </span>
          )}
          {themeToggle}
          {status === "signed-in" && (
            <button className="logout" onClick={logout}>
              Esci
            </button>
          )}
        </div>
      </header>

      {status !== "signed-in" && (
        <section>
          <p>Accedi con il tuo account Google per collegarti al foglio presenze.</p>
          <button onClick={login} disabled={status === "signing-in"}>
            {status === "signing-in" ? "Accesso in corso..." : "Accedi con Google"}
          </button>
          {status === "error" && errorMessage && <p className="error">{errorMessage}</p>}
        </section>
      )}

      {status === "signed-in" && accessToken && (
        <>
          <nav className="view-tabs">
            <button className={view === "daily" ? "active" : undefined} onClick={() => setView("daily")}>
              Giornaliera
            </button>
            <button className={view === "weekly" ? "active" : undefined} onClick={() => setView("weekly")}>
              Settimanale
            </button>
            <button className={view === "monthly" ? "active" : undefined} onClick={() => setView("monthly")}>
              Mensile
            </button>
            <button className={view === "absences" ? "active" : undefined} onClick={() => setView("absences")}>
              Assenze
            </button>
            <button className={view === "expenses" ? "active" : undefined} onClick={() => setView("expenses")}>
              Spese
            </button>
            <button className={view === "assignments" ? "active" : undefined} onClick={() => setView("assignments")}>
              Incarichi
            </button>
            <button className={view === "export" ? "active" : undefined} onClick={() => setView("export")}>
              Export
            </button>
          </nav>

          {view === "daily" && (
            <DailyTimeEntry
              accessToken={accessToken}
              spreadsheetId={SPREADSHEET_ID}
              date={dailyDate}
              onDateChange={setDailyDate}
            />
          )}
          {view === "weekly" && (
            <WeeklyView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} onSelectDay={handleSelectDay} />
          )}
          {view === "monthly" && (
            <MonthlyView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} onSelectDay={handleSelectDay} />
          )}
          {view === "absences" && <AbsencesView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} />}
          {view === "expenses" && <ExpensesView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} />}
          {view === "assignments" && <AssignmentsView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} />}
          {view === "export" && <ExportView accessToken={accessToken} spreadsheetId={SPREADSHEET_ID} />}

          <details className="diagnostics">
            <summary>Diagnostica collegamento foglio</summary>
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
          </details>
        </>
      )}
    </main>
  );
}

export default App;
