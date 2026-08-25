import { useCallback, useState } from "react";
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPES, appendAbsenceEntry, type AbsenceType } from "../lib/absences";
import { todayLocalISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";

interface AbsenceFormProps {
  accessToken: string;
  spreadsheetId: string;
  onSaved: () => void;
}

export function AbsenceForm({ accessToken, spreadsheetId, onSaved }: AbsenceFormProps) {
  const [date, setDate] = useState(todayLocalISODate);
  const [type, setType] = useState<AbsenceType>(ABSENCE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

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
      setError("Inserisci una quantità valida (maggiore di zero).");
      return;
    }

    setSaving(true);
    try {
      await appendAbsenceEntry(accessToken, spreadsheetId, { date, type, amount: amountNumber, note });
      setSavedMessage("Assenza registrata.");
      setAmount("");
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  }, [accessToken, spreadsheetId, date, type, amount, note, onSaved]);

  return (
    <section className="absence-form">
      <h2>Registra assenza</h2>

      <label className="field">
        Data
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="field">
        Tipo
        <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
          {ABSENCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ABSENCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Quantità (ore o giorni, a seconda del tipo)
        <input type="number" step="0.5" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>

      <label className="field">
        Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>

      {error && <p className="error">{error}</p>}
      {savedMessage && <p className="success">{savedMessage}</p>}

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Salvataggio..." : "Salva assenza"}
      </button>
    </section>
  );
}
