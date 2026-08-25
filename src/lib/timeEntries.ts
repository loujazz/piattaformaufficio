import { appendValues, deleteRow, getSheetIdByTitle, getValues, updateValues } from "./googleSheetsApi";

export interface TimeEntry {
  date: string; // YYYY-MM-DD
  checkIn: string; // HH:MM
  checkOut: string; // HH:MM
  minutesWorked: number;
  activityNote: string;
  offSite: boolean;
  offSiteLocation: string;
  isWeekendOverride: boolean;
  assignmentLink: string; // link Drive al PDF dell'incarico per quel turno, opzionale
  rowNumber: number; // numero di riga nel foglio (1-based, header = riga 1)
}

const SHEET = "TimeEntries";
const DATA_RANGE = `${SHEET}!A2:I`;

function toMinutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function computeMinutesWorked(checkIn: string, checkOut: string): number {
  return toMinutesSinceMidnight(checkOut) - toMinutesSinceMidnight(checkIn);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function isTrue(value: string | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "TRUE";
}

function parseRow(row: string[], rowNumber: number): TimeEntry {
  return {
    date: row[0] ?? "",
    checkIn: row[1] ?? "",
    checkOut: row[2] ?? "",
    minutesWorked: Number(row[3] ?? 0),
    activityNote: row[4] ?? "",
    offSite: isTrue(row[5]),
    offSiteLocation: row[6] ?? "",
    isWeekendOverride: isTrue(row[7]),
    assignmentLink: row[8] ?? "",
    rowNumber,
  };
}

/** Legge tutti i TimeEntries salvati. Più righe possono condividere la stessa data (giornate con più turni). */
export async function listTimeEntries(accessToken: string, spreadsheetId: string): Promise<TimeEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.map((row, i) => parseRow(row, i + 2)).filter((entry) => entry.date);
}

/** Turni con un link di incarico compilato, dal più recente. */
export async function listAssignments(accessToken: string, spreadsheetId: string): Promise<TimeEntry[]> {
  const entries = await listTimeEntries(accessToken, spreadsheetId);
  return entries.filter((e) => e.assignmentLink.trim()).sort((a, b) => b.date.localeCompare(a.date) || b.checkIn.localeCompare(a.checkIn));
}

/** Turni già salvati per una data (YYYY-MM-DD), ordinati per orario di entrata. */
export async function listTimeEntriesForDate(accessToken: string, spreadsheetId: string, date: string): Promise<TimeEntry[]> {
  const entries = await listTimeEntries(accessToken, spreadsheetId);
  return entries.filter((e) => e.date === date).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

export interface DaySummary {
  totalMinutes: number;
  firstCheckIn: string;
  lastCheckOut: string;
  segments: TimeEntry[];
}

/** Raggruppa una lista di TimeEntries per data. */
export function groupTimeEntriesByDate(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const map = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.date, [entry]);
    }
  }
  return map;
}

/** Riepilogo di una giornata (eventualmente su più turni): ore totali, primo ingresso, ultima uscita. */
export function summarizeDay(dayEntries: TimeEntry[]): DaySummary {
  const sorted = [...dayEntries].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return {
    totalMinutes: sorted.reduce((sum, e) => sum + e.minutesWorked, 0),
    firstCheckIn: sorted[0]?.checkIn ?? "",
    lastCheckOut: sorted[sorted.length - 1]?.checkOut ?? "",
    segments: sorted,
  };
}

/**
 * Salva un turno: aggiorna la riga esistente se rowNumber è passato,
 * altrimenti aggiunge una nuova riga in fondo al tab (un nuovo turno per quel giorno).
 */
export async function saveTimeEntry(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<TimeEntry, "rowNumber">,
  rowNumber: number | null,
): Promise<void> {
  const values = [
    [
      entry.date,
      entry.checkIn,
      entry.checkOut,
      entry.minutesWorked,
      entry.activityNote,
      entry.offSite,
      entry.offSiteLocation,
      entry.isWeekendOverride,
      entry.assignmentLink,
    ],
  ];
  if (rowNumber !== null) {
    await updateValues(accessToken, spreadsheetId, `${SHEET}!A${rowNumber}:I${rowNumber}`, values);
  } else {
    await appendValues(accessToken, spreadsheetId, `${SHEET}!A:I`, values);
  }
}

/** Elimina un turno (riga) esistente. */
export async function deleteTimeEntry(accessToken: string, spreadsheetId: string, rowNumber: number): Promise<void> {
  const sheetId = await getSheetIdByTitle(accessToken, spreadsheetId, SHEET);
  await deleteRow(accessToken, spreadsheetId, sheetId, rowNumber);
}
