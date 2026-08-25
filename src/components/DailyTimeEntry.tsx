import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isItalianHoliday, isWeekend, nowLocalHHMM, parseISODate, todayLocalISODate } from "../lib/date";
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
  const [weekendOverride, setWeekendOverride] = useState(false);
  const [offSite, setOffSite] = useState(false);
  const [offSiteLocation, setOffSiteLocation] = useState("");
  const [rowNumber, setRowNumber] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Applicato dopo il caricamento, per evitare che il fetch del giorno sovrascriva
  // l'orario "ora" impostato da un'azione rapida quando si cambia data insieme ad essa.
  const pendingQuickAction = useRef<"checkIn" | "checkOut" | null>(null);

  const dayInfo = useMemo(() => {
    const parsed = parseISODate(date);
    const weekend = isWeekend(parsed);
    const holiday = isItalianHoliday(parsed);
    return { nonWorking: weekend || holiday, weekend, holiday };
  }, [date]);

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
        setWeekendOverride(stored.entry.isWeekendOverride);
        setOffSite(stored.entry.offSite);
        setOffSiteLocation(stored.entry.offSiteLocation);
        setRowNumber(stored.rowNumber);
      } else {
        setCheckIn("");
        setCheckOut("");
        setActivityNote("");
        setWeekendOverride(false);
        setOffSite(false);
        setOffSiteLocation("");
        setRowNumber(null);
      }
      if (pendingQuickAction.current === "checkIn") {
        setCheckIn(nowLocalHHMM());
      } else if (pendingQuickAction.current === "checkOut") {
        setCheckOut(nowLocalHHMM());
      }
      pendingQuickAction.current = null;
    } catch (err) {
      pendingQuickAction.current = null;
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
    if (dayInfo.nonWorking && !weekendOverride) {
      setFormError("Questo giorno non è lavorativo (weekend o festività). Spunta la conferma per registrare comunque le ore.");
      return;
    }
    if (offSite && !offSiteLocation.trim()) {
      setFormError("Indica il luogo della trasferta.");
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
          offSite,
          offSiteLocation: offSite ? offSiteLocation.trim() : "",
          isWeekendOverride: dayInfo.nonWorking ? weekendOverride : false,
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
  }, [
    accessToken,
    spreadsheetId,
    date,
    checkIn,
    checkOut,
    activityNote,
    weekendOverride,
    offSite,
    offSiteLocation,
    dayInfo,
    rowNumber,
    loadEntry,
  ]);

  const livePreviewMinutes = checkIn && checkOut && checkOut > checkIn ? computeMinutesWorked(checkIn, checkOut) : null;
  const isToday = date === todayLocalISODate();

  const handleQuickCheckIn = useCallback(() => {
    const todayIso = todayLocalISODate();
    if (date === todayIso) {
      setCheckIn(nowLocalHHMM());
    } else {
      pendingQuickAction.current = "checkIn";
      setDate(todayIso);
    }
  }, [date]);

  const handleQuickCheckOut = useCallback(() => {
    const todayIso = todayLocalISODate();
    if (date === todayIso) {
      setCheckOut(nowLocalHHMM());
    } else {
      pendingQuickAction.current = "checkOut";
      setDate(todayIso);
    }
  }, [date]);

  return (
    <section className="daily-entry">
      <h2>Vista giornaliera</h2>

      <div className="quick-actions">
        <button type="button" className="quick-action" onClick={handleQuickCheckIn}>
          Entra ora
        </button>
        <button type="button" className="quick-action" onClick={handleQuickCheckOut}>
          Esci ora
        </button>
      </div>
      {!isToday && <p className="hint">Stai modificando un giorno diverso da oggi.</p>}

      <label className="field">
        Giorno
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {loading && <p>Caricamento...</p>}
      {loadError && <p className="error">{loadError}</p>}

      {!loading && (
        <>
          {rowNumber !== null && <p className="hint">Presenza già registrata per questo giorno: la modifica la sovrascrive.</p>}

          {dayInfo.nonWorking && (
            <p className="warning">
              ⚠️ {dayInfo.holiday ? "Festività" : "Weekend"}: giorno normalmente non lavorativo.
            </p>
          )}

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

          {dayInfo.nonWorking && (
            <label className="checkbox-field">
              <input type="checkbox" checked={weekendOverride} onChange={(e) => setWeekendOverride(e.target.checked)} />
              Registra comunque le ore per questo giorno (evento/missione)
            </label>
          )}

          <label className="checkbox-field">
            <input type="checkbox" checked={offSite} onChange={(e) => setOffSite(e.target.checked)} />
            Fuori sede (trasferta)
          </label>

          {offSite && (
            <label className="field">
              Luogo
              <input
                type="text"
                value={offSiteLocation}
                onChange={(e) => setOffSiteLocation(e.target.value)}
                placeholder="Dove ti trovi..."
              />
            </label>
          )}

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
