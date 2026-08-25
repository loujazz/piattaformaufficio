import { startTransition, useCallback, useEffect, useState } from "react";
import { dayLabelIt, parseISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { listAssignments, type TimeEntry } from "../lib/timeEntries";

interface AssignmentsViewProps {
  accessToken: string;
  spreadsheetId: string;
}

export function AssignmentsView({ accessToken, spreadsheetId }: AssignmentsViewProps) {
  const [assignments, setAssignments] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignments(await listAssignments(accessToken, spreadsheetId));
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento degli incarichi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, spreadsheetId]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  return (
    <section className="assignments-view">
      <h2>Incarichi</h2>

      <div className="nav">
        <button onClick={() => void load()} disabled={loading}>
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <table className="entries-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Turno</th>
            <th>Attività</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.rowNumber} className="clickable-row" onClick={() => window.open(a.assignmentLink, "_blank", "noreferrer")}>
              <td>
                {dayLabelIt(parseISODate(a.date))} {a.date}
              </td>
              <td>{a.checkIn && a.checkOut ? `${a.checkIn}–${a.checkOut}` : "—"}</td>
              <td>{a.activityNote || "—"}</td>
            </tr>
          ))}
          {assignments.length === 0 && !loading && (
            <tr>
              <td colSpan={3}>Nessun incarico registrato.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
