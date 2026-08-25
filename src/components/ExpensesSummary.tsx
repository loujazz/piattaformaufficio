import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { REIMBURSEMENT_STATUS_LABELS, deleteExpenseEntry, listExpenseEntries, type ExpenseEntry } from "../lib/expenses";
import { SheetsApiError } from "../lib/googleSheetsApi";

interface ExpensesSummaryProps {
  accessToken: string;
  spreadsheetId: string;
  refreshKey: number;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function ExpensesSummary({ accessToken, spreadsheetId, refreshKey }: ExpensesSummaryProps) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingRowNumber, setDeletingRowNumber] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listExpenseEntries(accessToken, spreadsheetId));
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento delle spese.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, spreadsheetId]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
    // refreshKey forza un ricaricamento dopo il salvataggio di una nuova spesa dal form.
  }, [load, refreshKey]);

  const handleDelete = useCallback(
    async (rowNumber: number) => {
      if (!window.confirm("Eliminare questa spesa? L'operazione non è reversibile.")) return;
      setDeletingRowNumber(rowNumber);
      setError(null);
      try {
        await deleteExpenseEntry(accessToken, spreadsheetId, rowNumber);
        await load();
      } catch (err) {
        setError(err instanceof SheetsApiError ? err.message : "Errore nell'eliminazione.");
      } finally {
        setDeletingRowNumber(null);
      }
    },
    [accessToken, spreadsheetId, load],
  );

  const yearEntries = useMemo(
    () =>
      entries
        .filter((e) => e.date.startsWith(`${year}-`))
        .sort((a, b) => (a.missionRef || a.date).localeCompare(b.missionRef || b.date) || a.date.localeCompare(b.date)),
    [entries, year],
  );

  const totals = useMemo(() => {
    const spent = yearEntries.reduce((sum, e) => sum + e.amount, 0);
    const reimbursed = yearEntries.reduce((sum, e) => sum + e.reimbursedAmount, 0);
    return { spent, reimbursed, pending: spent - reimbursed };
  }, [yearEntries]);

  return (
    <section className="expenses-summary">
      <h2>Riepilogo spese</h2>

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

      <table className="entries-table totals-table">
        <tbody>
          <tr>
            <td>Totale sostenuto</td>
            <td>{formatCurrency(totals.spent)}</td>
          </tr>
          <tr>
            <td>Totale rimborsato</td>
            <td>{formatCurrency(totals.reimbursed)}</td>
          </tr>
          <tr className={totals.pending > 0 ? "negative" : undefined}>
            <td>Ancora da ricevere</td>
            <td>{formatCurrency(totals.pending)}</td>
          </tr>
        </tbody>
      </table>

      <table className="entries-table">
        <thead>
          <tr>
            <th>Missione</th>
            <th>Data</th>
            <th>Importo</th>
            <th>Descrizione</th>
            <th>Ricevuta</th>
            <th>Stato</th>
            <th>Rimborsato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {yearEntries.map((e) => (
            <tr key={e.rowNumber}>
              <td>{e.missionRef || "—"}</td>
              <td>{e.date}</td>
              <td>{formatCurrency(e.amount)}</td>
              <td>{e.description}</td>
              <td>
                {e.driveLink ? (
                  <a href={e.driveLink} target="_blank" rel="noreferrer">
                    Apri
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td>{REIMBURSEMENT_STATUS_LABELS[e.reimbursementStatus]}</td>
              <td>{formatCurrency(e.reimbursedAmount)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => void handleDelete(e.rowNumber)}
                  disabled={deletingRowNumber === e.rowNumber}
                >
                  {deletingRowNumber === e.rowNumber ? "Eliminazione..." : "Elimina"}
                </button>
              </td>
            </tr>
          ))}
          {yearEntries.length === 0 && !loading && (
            <tr>
              <td colSpan={8}>Nessuna spesa registrata per {year}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
