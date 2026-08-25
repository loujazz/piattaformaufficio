import { startTransition, useCallback, useEffect, useState } from "react";
import { todayLocalISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { computeMinutesWorked, findTimeEntryForDate, formatMinutes, saveTimeEntry } from "../lib/timeEntries";

interface DailyTimeEntryProps {
  accessToken: string;
  spreadsheetId: string;
}

export function DailyTimeEntry({ accessToken, spreadsheetId }: DailyTimeEntryProps) {
  const [date, setDate] = useState(todayLocalISODate);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [rowNumber, setRowNumber] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSavedMessage(null);
    try {
      const stored = await findTimeEntryForDate(accessToken, spreadsheetId, date);
      if (stored) {
        setCheckIn(stored.entry.checkIn);
        setCheckOut(stored.entry.checkOut);
        setActivityNote(stored.entry.activityNote);
        setRowNumber(stored.rowNumber);
      } else {
        setCheckIn("");
        setCheckOut("");
        setActivityNote("");
        setRowNumber(null);
      }
    } catch (err) {
      setLoadError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento del giorno selezionato.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, spreadsheetId, date]);

  useEffect(() => {
    startTransition(() => {
      void loadEntry();
    });
  }, [loadEntry]);

  const handleSave = useCallback(async () => {
    setFormError(null);
    setSavedMessage(null);

    if (!checkIn || !checkOut) {
      setFormError("Inserisci sia l'orario di entrata che quello di uscita.");
      return;
    }
    if (checkOut <= checkIn) {
      setFormError("L'orario di uscita deve essere successivo a quello di entrata.");
      return;
    }

    setSaving(true);
    try {
      const minutesWorked = computeMinutesWorked(checkIn, checkOut);
      await saveTimeEntry(
        accessToken,
        spreadsheetId,
        {
          date,
          checkIn,
          checkOut,
          minutesWorked,
          activityNote,
          offSite: false,
          offSiteLocation: "",
          isWeekendOverride: false,
        },
        rowNumber,
      );
      setSavedMessage("Presenza salvata.");
      await loadEntry();
    } catch (err) {
      setFormError(err instanceof SheetsApiError ? err.message : "Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  }, [accessToken, spreadsheetId, date, checkIn, checkOut, activityNote, rowNumber, loadEntry]);

  const livePreviewMinutes = checkIn && checkOut && checkOut > checkIn ? computeMinutesWorked(checkIn, checkOut) : null;

  return (
    <section className="daily-entry">
      <h2>Vista giornaliera</h2>

      <label className="field">
        Giorno
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading && <p>Caricamento...</p>}
      {loadError && <p className="error">{loadError}</p>}

      {!loading && (
        <>
          {rowNumber !== null && <p className="hint">Presenza già registrata per questo giorno: la modifica la sovrascrive.</p>}

          <label className="field">
            Entrata
            <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>

          <label className="field">
            Uscita
            <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>

          <label className="field">
            Attività
            <textarea
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
              rows={3}
              placeholder="Cosa hai fatto oggi..."
            />
          </label>

          {livePreviewMinutes !== null && <p className="hint">Ore lavorate: {formatMinutes(livePreviewMinutes)}</p>}

          {formError && <p className="error">{formError}</p>}
          {savedMessage && <p className="success">{savedMessage}</p>}

          <button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : rowNumber !== null ? "Aggiorna presenza" : "Salva presenza"}
          </button>
        </>
      )}
    </section>
  );
}
