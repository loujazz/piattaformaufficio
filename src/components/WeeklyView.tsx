import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { addDays, dayLabelIt, isItalianHoliday, isWeekend, startOfWeekMonday, toISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { formatMinutes, groupTimeEntriesByDate, listTimeEntries, summarizeDay, type TimeEntry } from "../lib/timeEntries";
import { WeekPickerField } from "./WeekPickerField";

interface WeeklyViewProps {
  accessToken: string;
  spreadsheetId: string;
}

export function WeeklyView({ accessToken, spreadsheetId }: WeeklyViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
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

  const entriesByDate = useMemo(() => groupTimeEntriesByDate(entries), [entries]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekTotalMinutes = days.reduce(
    (total, day) => total + summarizeDay(entriesByDate.get(toISODate(day)) ?? []).totalMinutes,
    0,
  );

  return (
    <section className="weekly-view">
      <h2>Vista settimanale</h2>

      <div className="nav">
        <button onClick={() => setWeekStart((d) => addDays(d, -7))}>← Settimana prec.</button>
        <button onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>Oggi</button>
        <button onClick={() => setWeekStart((d) => addDays(d, 7))}>Settimana succ. →</button>
        <WeekPickerField weekStart={weekStart} onChange={setWeekStart} />
        <button onClick={() => void loadEntries()} disabled={loading}>
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      <p className="hint">
        {toISODate(days[0])} — {toISODate(days[6])}
      </p>

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
            const daySegments = entriesByDate.get(iso) ?? [];
            const summary = summarizeDay(daySegments);
            const nonWorking = isWeekend(day) || isItalianHoliday(day);
            return (
              <tr key={iso} className={nonWorking ? "non-working" : undefined}>
                <td>
                  {dayLabelIt(day)} {iso}
                  {nonWorking && daySegments.length === 0 && <span className="hint"> (non lavorativo)</span>}
                  {daySegments.length > 1 && <span className="hint"> ({daySegments.length} turni)</span>}
                </td>
                <td>{summary.firstCheckIn || "—"}</td>
                <td>{summary.lastCheckOut || "—"}</td>
                <td>{daySegments.length > 0 ? formatMinutes(summary.totalMinutes) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>Totale settimana</strong>
            </td>
            <td>
              <strong>{formatMinutes(weekTotalMinutes)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
