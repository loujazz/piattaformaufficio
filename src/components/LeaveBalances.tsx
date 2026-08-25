import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { ABSENCE_TYPE_LABELS, listAbsenceEntries, type AbsenceEntry, type AbsenceType } from "../lib/absences";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { listLeaveConfig, type LeaveConfigEntry } from "../lib/leaveConfig";

interface LeaveBalancesProps {
  accessToken: string;
  spreadsheetId: string;
  refreshKey: number;
}

export function LeaveBalances({ accessToken, spreadsheetId, refreshKey }: LeaveBalancesProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [config, setConfig] = useState<LeaveConfigEntry[]>([]);
  const [absences, setAbsences] = useState<AbsenceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRows, absenceRows] = await Promise.all([
        listLeaveConfig(accessToken, spreadsheetId),
        listAbsenceEntries(accessToken, spreadsheetId),
      ]);
      setConfig(configRows);
      setAbsences(absenceRows);
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento dei saldi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, spreadsheetId]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
    // refreshKey forza un ricaricamento dopo il salvataggio di una nuova assenza dal form.
  }, [load, refreshKey]);

  const rows = useMemo(
    () =>
      config.map((c) => {
        const used = absences
          .filter((a) => a.type === c.type && a.date.startsWith(`${year}-`))
          .reduce((sum, a) => sum + a.amount, 0);
        return {
          type: c.type,
          label: ABSENCE_TYPE_LABELS[c.type as AbsenceType] ?? c.type,
          allocatedTotal: c.allocatedTotal,
          used,
          residual: c.allocatedTotal - used,
        };
      }),
    [config, absences, year],
  );

  return (
    <section className="leave-balances">
      <h2>Saldi assenze</h2>

      <div className="nav">
        <button onClick={() => setYear((y) => y - 1)}>← Anno prec.</button>
        <button onClick={() => setYear(new Date().getFullYear())}>Anno corrente</button>
        <button onClick={() => setYear((y) => y + 1)}>Anno succ. →</button>
        <button onClick={() => void load()} disabled={loading}>
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      <p className="hint">{year}</p>

      {error && <p className="error">{error}</p>}

      <table className="entries-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Dotazione</th>
            <th>Usato</th>
            <th>Residuo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type} className={r.residual < 0 ? "negative" : undefined}>
              <td>{r.label}</td>
              <td>{r.allocatedTotal}</td>
              <td>{r.used}</td>
              <td>{r.residual}</td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={4}>Nessun tipo configurato nel tab LeaveConfig.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
