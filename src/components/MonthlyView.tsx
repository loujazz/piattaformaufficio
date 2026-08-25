import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { dayLabelIt, daysInMonth, isItalianHoliday, isWeekend, monthLabelIt, startOfMonth, toISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { formatMinutes, listTimeEntries, type TimeEntry } from "../lib/timeEntries";

interface MonthlyViewProps {
  accessToken: string;
  spreadsheetId: string;
}

export function MonthlyView({ accessToken, spreadsheetId }: MonthlyViewProps) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listTimeEntries(accessToken, spreadsheetId));
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento delle presenze.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, spreadsheetId]);

  useEffect(() => {
    startTransition(() => {
      void loadEntries();
    });
  }, [loadEntries]);

  const entriesByDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  const days = useMemo(() => {
    const total = daysInMonth(monthStart);
    return Array.from({ length: total }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
  }, [monthStart]);

  const monthTotalMinutes = days.reduce((total, day) => total + (entriesByDate.get(toISODate(day))?.minutesWorked ?? 0), 0);

  return (
    <section className="monthly-view">
      <h2>Vista mensile</h2>

      <div className="nav">
        <button onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>← Mese prec.</button>
        <button onClick={() => setMonthStart(startOfMonth(new Date()))}>Oggi</button>
        <button onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Mese succ. →</button>
        <button onClick={() => void loadEntries()} disabled={loading}>
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      <p className="hint">{monthLabelIt(monthStart)}</p>

      {error && <p className="error">{error}</p>}

      <table className="entries-table">
        <thead>
          <tr>
            <th>Giorno</th>
            <th>Entrata</th>
            <th>Uscita</th>
            <th>Ore</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const iso = toISODate(day);
            const entry = entriesByDate.get(iso);
            const nonWorking = isWeekend(day) || isItalianHoliday(day);
            return (
              <tr key={iso} className={nonWorking ? "non-working" : undefined}>
                <td>
                  {dayLabelIt(day)} {iso}
                </td>
                <td>{entry?.checkIn ?? "—"}</td>
                <td>{entry?.checkOut ?? "—"}</td>
                <td>{entry ? formatMinutes(entry.minutesWorked) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>Totale mese</strong>
            </td>
            <td>
              <strong>{formatMinutes(monthTotalMinutes)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
