import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isItalianHoliday, isWeekend, nowLocalHHMM, parseISODate, todayLocalISODate } from "../lib/date";
import { SheetsApiError } from "../lib/googleSheetsApi";
import { DayPickerField } from "./DayPickerField";
import {
  computeMinutesWorked,
  deleteTimeEntry,
  formatMinutes,
  listTimeEntriesForDate,
  saveTimeEntry,
  summarizeDay,
  type TimeEntry,
} from "../lib/timeEntries";

interface DailyTimeEntryProps {
  accessToken: string;
  spreadsheetId: string;
  date: string;
  onDateChange: (iso: string) => void;
}

export function DailyTimeEntry({ accessToken, spreadsheetId, date, onDateChange }: DailyTimeEntryProps) {
  const [segments, setSegments] = useState<TimeEntry[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingRowNumber, setDeletingRowNumber] = useState<number | null>(null);

  const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [weekendOverride, setWeekendOverride] = useState(false);
  const [offSite, setOffSite] = useState(false);
  const [offSiteLocation, setOffSiteLocation] = useState("");
  const [assignmentLink, setAssignmentLink] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");

  const [saving, setSaving] = useState(false);
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

  const resetFormForNewSegment = useCallback(() => {
    setEditingRowNumber(null);
    setCheckIn("");
    setCheckOut("");
    setActivityNote("");
    setWeekendOverride(false);
    setOffSite(false);
    setOffSiteLocation("");
    setAssignmentLink("");
    setAssignmentTitle("");
  }, []);

  const loadSegments = useCallback(async () => {
    setLoadingSegments(true);
    setLoadError(null);
    setSavedMessage(null);
    try {
      setSegments(await listTimeEntriesForDate(accessToken, spreadsheetId, date));
    } catch (err) {
      setLoadError(err instanceof SheetsApiError ? err.message : "Errore nel caricamento del giorno selezionato.");
    } finally {
      setLoadingSegments(false);
    }
    resetFormForNewSegment();
    if (pendingQuickAction.current === "checkIn") {
      setCheckIn(nowLocalHHMM());
    } else if (pendingQuickAction.current === "checkOut") {
      setCheckOut(nowLocalHHMM());
    }
    pendingQuickAction.current = null;
  }, [accessToken, spreadsheetId, date, resetFormForNewSegment]);

  useEffect(() => {
    startTransition(() => {
      void loadSegments();
    });
  }, [loadSegments]);

  const handleQuickCheckIn = useCallback(() => {
    const todayIso = todayLocalISODate();
    if (date === todayIso) {
      resetFormForNewSegment();
      setCheckIn(nowLocalHHMM());
    } else {
      pendingQuickAction.current = "checkIn";
      onDateChange(todayIso);
    }
  }, [date, onDateChange, resetFormForNewSegment]);

  const handleQuickCheckOut = useCallback(() => {
    const todayIso = todayLocalISODate();
    if (date === todayIso) {
      setCheckOut(nowLocalHHMM());
    } else {
      pendingQuickAction.current = "checkOut";
      onDateChange(todayIso);
    }
  }, [date, onDateChange]);

  const handleEditSegment = useCallback((segment: TimeEntry) => {
    setEditingRowNumber(segment.rowNumber);
    setCheckIn(segment.checkIn);
    setCheckOut(segment.checkOut);
    setActivityNote(segment.activityNote);
    setWeekendOverride(segment.isWeekendOverride);
    setOffSite(segment.offSite);
    setOffSiteLocation(segment.offSiteLocation);
    setAssignmentLink(segment.assignmentLink);
    setAssignmentTitle(segment.assignmentTitle);
    setFormError(null);
    setSavedMessage(null);
  }, []);

  const handleDeleteSegment = useCallback(
    async (rowNumber: number) => {
      if (!window.confirm("Eliminare questo turno? L'operazione non è reversibile.")) return;
      setDeletingRowNumber(rowNumber);
      setLoadError(null);
      try {
        await deleteTimeEntry(accessToken, spreadsheetId, rowNumber);
        if (editingRowNumber === rowNumber) resetFormForNewSegment();
        await loadSegments();
      } catch (err) {
        setLoadError(err instanceof SheetsApiError ? err.message : "Errore nell'eliminazione.");
      } finally {
        setDeletingRowNumber(null);
      }
    },
    [accessToken, spreadsheetId, editingRowNumber, resetFormForNewSegment, loadSegments],
  );

  const handleSave = useCallback(async () => {
    setFormError(null);
    setSavedMessage(null);

    const bothTimesEmpty = !checkIn && !checkOut;
    const bothTimesFilled = Boolean(checkIn) && Boolean(checkOut);

    if (!bothTimesEmpty && !bothTimesFilled) {
      setFormError("Inserisci sia l'orario di entrata che quello di uscita, oppure lasciali entrambi vuoti per registrare solo l'incarico.");
      return;
    }
    if (bothTimesFilled && checkOut <= checkIn) {
      setFormError("L'orario di uscita deve essere successivo a quello di entrata.");
      return;
    }
    if (bothTimesEmpty && !assignmentLink.trim()) {
      setFormError("Inserisci gli orari del turno, oppure almeno il link dell'incarico.");
      return;
    }
    if (bothTimesFilled && dayInfo.nonWorking && !weekendOverride) {
      setFormError("Questo giorno non è lavorativo (weekend o festività). Spunta la conferma per registrare comunque le ore.");
      return;
    }
    if (offSite && !offSiteLocation.trim()) {
      setFormError("Indica il luogo della trasferta.");
      return;
    }

    setSaving(true);
    try {
      const minutesWorked = bothTimesFilled ? computeMinutesWorked(checkIn, checkOut) : 0;
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
          assignmentLink: assignmentLink.trim(),
          assignmentTitle: assignmentTitle.trim(),
        },
        editingRowNumber,
      );
      setSavedMessage(editingRowNumber !== null ? "Turno aggiornato." : "Turno aggiunto.");
      await loadSegments();
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
    assignmentLink,
    assignmentTitle,
    dayInfo,
    editingRowNumber,
    loadSegments,
  ]);

  const livePreviewMinutes = checkIn && checkOut && checkOut > checkIn ? computeMinutesWorked(checkIn, checkOut) : null;
  const isToday = date === todayLocalISODate();
  const daySummary = summarizeDay(segments);

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
        <DayPickerField value={date} onChange={onDateChange} />
      </label>

      {loadingSegments && <p>Caricamento...</p>}
      {loadError && <p className="error">{loadError}</p>}

      {!loadingSegments && (
        <>
          {dayInfo.nonWorking && (
            <p className="warning">⚠️ {dayInfo.holiday ? "Festività" : "Weekend"}: giorno normalmente non lavorativo.</p>
          )}

          {segments.length > 0 && (
            <div className="segments-list">
              <p className="hint">
                Turni registrati — totale giornata: <strong>{formatMinutes(daySummary.totalMinutes)}</strong>
              </p>
              <ul>
                {segments.map((segment) => (
                  <li key={segment.rowNumber} className={editingRowNumber === segment.rowNumber ? "editing" : undefined}>
                    {segment.checkIn && segment.checkOut && (
                      <span className="segment-time">
                        {segment.checkIn}–{segment.checkOut} ({formatMinutes(segment.minutesWorked)})
                      </span>
                    )}
                    {segment.offSite && <span className="segment-tag">Fuori sede: {segment.offSiteLocation}</span>}
                    {segment.assignmentLink && (
                      <a className="segment-tag" href={segment.assignmentLink} target="_blank" rel="noreferrer">
                        📄 {segment.assignmentTitle || "Incarico"}
                      </a>
                    )}
                    {segment.activityNote && <span className="segment-note">{segment.activityNote}</span>}
                    <span className="segment-actions">
                      <button type="button" onClick={() => handleEditSegment(segment)}>
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSegment(segment.rowNumber)}
                        disabled={deletingRowNumber === segment.rowNumber}
                      >
                        {deletingRowNumber === segment.rowNumber ? "Eliminazione..." : "Elimina"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3>{editingRowNumber !== null ? "Modifica turno" : "Aggiungi turno"}</h3>

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
              Registra comunque le ore per questo turno (evento/missione)
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

          <label className="field">
            Titolo incarico
            <input
              type="text"
              value={assignmentTitle}
              onChange={(e) => setAssignmentTitle(e.target.value)}
              placeholder="Es. Corso di formazione, Missione a..."
            />
          </label>

          <label className="field">
            Incarico (link Drive)
            <input
              type="url"
              value={assignmentLink}
              onChange={(e) => setAssignmentLink(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </label>
          {!checkIn && !checkOut && (
            <p className="hint">
              Puoi salvare solo l'incarico, senza orari, se vuoi registrarlo prima di timbrare il turno.
            </p>
          )}

          {livePreviewMinutes !== null && <p className="hint">Ore del turno: {formatMinutes(livePreviewMinutes)}</p>}

          {formError && <p className="error">{formError}</p>}
          {savedMessage && <p className="success">{savedMessage}</p>}

          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving
              ? "Salvataggio..."
              : editingRowNumber !== null
                ? "Salva modifiche"
                : !checkIn && !checkOut
                  ? "Salva incarico"
                  : "Aggiungi turno"}
          </button>
          {editingRowNumber !== null && (
            <button type="button" onClick={resetFormForNewSegment} disabled={saving}>
              Annulla modifica
            </button>
          )}
        </>
      )}
    </section>
  );
}
