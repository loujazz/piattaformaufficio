import { useCallback, useState } from "react";
import { todayLocalISODate } from "../lib/date";
import {
  appendExpenseEntry,
  REIMBURSEMENT_STATUS_LABELS,
  REIMBURSEMENT_STATUSES,
  type ReimbursementStatus,
} from "../lib/expenses";
import { SheetsApiError } from "../lib/googleSheetsApi";

interface ExpenseFormProps {
  accessToken: string;
  spreadsheetId: string;
  onSaved: () => void;
}

export function ExpenseForm({ accessToken, spreadsheetId, onSaved }: ExpenseFormProps) {
  const [date, setDate] = useState(todayLocalISODate);
  const [missionRef, setMissionRef] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [reimbursementStatus, setReimbursementStatus] = useState<ReimbursementStatus>("da_richiedere");
  const [reimbursedAmount, setReimbursedAmount] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    setSavedMessage(null);

    if (!date) {
      setError("Seleziona una data.");
      return;
    }
    const amountNumber = Number(amount.replace(",", "."));
    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Inserisci un importo valido (maggiore di zero).");
      return;
    }
    const reimbursedNumber = reimbursedAmount ? Number(reimbursedAmount.replace(",", ".")) : 0;
    if (Number.isNaN(reimbursedNumber) || reimbursedNumber < 0) {
      setError("L'importo rimborsato non è valido.");
      return;
    }

    setSaving(true);
    try {
      await appendExpenseEntry(accessToken, spreadsheetId, {
        date,
        missionRef,
        amount: amountNumber,
        description,
        driveLink,
        reimbursementStatus,
        reimbursedAmount: reimbursedNumber,
      });
      setSavedMessage("Spesa registrata.");
      setAmount("");
      setDescription("");
      setDriveLink("");
      setReimbursedAmount("");
      setReimbursementStatus("da_richiedere");
      onSaved();
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  }, [accessToken, spreadsheetId, date, missionRef, amount, description, driveLink, reimbursementStatus, reimbursedAmount, onSaved]);

  return (
    <section className="expense-form">
      <h2>Registra spesa</h2>

      <label className="field">
        Data
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="field">
        Riferimento missione (data trasferta, opzionale)
        <input type="date" value={missionRef} onChange={(e) => setMissionRef(e.target.value)} />
      </label>

      <label className="field">
        Importo
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>

      <label className="field">
        Descrizione
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

      <label className="field">
        Link Drive (ricevuta/scontrino)
        <input
          type="url"
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          placeholder="https://drive.google.com/..."
        />
      </label>

      <label className="field">
        Stato rimborso
        <select value={reimbursementStatus} onChange={(e) => setReimbursementStatus(e.target.value as ReimbursementStatus)}>
          {REIMBURSEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REIMBURSEMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Importo rimborsato (se già ricevuto)
        <input type="number" step="0.01" min="0" value={reimbursedAmount} onChange={(e) => setReimbursedAmount(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}
      {savedMessage && <p className="success">{savedMessage}</p>}

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva spesa"}
      </button>
    </section>
  );
}
