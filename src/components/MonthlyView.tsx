import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { dayLabelIt, daysInMonth, isItalianHoliday, isWeekend, monthLabelIt, startOfMonth, toISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { formatMinutes, groupTimeEntriesByDate, listTimeEntries, summarizeDay, type TimeEntry } from "../lib/timeEntries";
import { MonthPickerField } from "./MonthPickerField";

interface MonthlyViewProps {
  accessToken: string;
  spreadsheetId: string;
  onSelectDay: (iso: string) => void;
}

export function MonthlyView({ accessToken, spreadsheetId, onSelectDay }: MonthlyViewProps) {
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

  const entriesByDate = useMemo(() => groupTimeEntriesByDate(entries), [entries]);

  const days = useMemo(() => {
    const total = daysInMonth(monthStart);
    return Array.from({ length: total }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
  }, [monthStart]);

  const monthTotalMinutes = days.reduce(
    (total, day) => total + summarizeDay(entriesByDate.get(toISODate(day)) ?? []).totalMinutes,
    0,
  );

  return (
    <section className="monthly-view">
      <h2>Vista mensile</h2>

      <div className="nav">
        <button onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>← Mese prec.</button>
        <button onClick={() => setMonthStart(startOfMonth(new Date()))}>Oggi</button>
        <button onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Mese succ. →</button>
        <MonthPickerField monthStart={monthStart} onChange={setMonthStart} />
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
            const daySegments = entriesByDate.get(iso) ?? [];
            const summary = summarizeDay(daySegments);
            const nonWorking = isWeekend(day) || isItalianHoliday(day);
            return (
              <tr
                key={iso}
                className={nonWorking ? "non-working clickable-row" : "clickable-row"}
                onClick={() => onSelectDay(iso)}
              >
                <td>
                  {dayLabelIt(day)} {iso}
                  {summary.segments.length > 1 && <span className="hint"> ({summary.segments.length} turni)</span>}
                  {daySegments.some((e) => !e.checkIn && e.assignmentLink) && <span className="hint"> 📄</span>}
                  {daySegments.some((e) => e.checkIn && !e.checkOut) && <span className="hint"> 🕐 in corso</span>}
                </td>
                <td>{summary.firstCheckIn || "—"}</td>
                <td>{summary.lastCheckOut || "—"}</td>
                <td>{summary.segments.length > 0 ? formatMinutes(summary.totalMinutes) : "—"}</td>
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
