import { appendValues, getValues, updateValues } from "./googleSheetsApi";

export interface TimeEntry {
  date: string; // YYYY-MM-DD
  checkIn: string; // HH:MM
  checkOut: string; // HH:MM
  minutesWorked: number;
  activityNote: string;
  offSite: boolean;
  offSiteLocation: string;
  isWeekendOverride: boolean;
}

const SHEET = "TimeEntries";
const DATA_RANGE = `${SHEET}!A2:H`;

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

function parseRow(row: string[]): TimeEntry {
  return {
    date: row[0] ?? "",
    checkIn: row[1] ?? "",
    checkOut: row[2] ?? "",
    minutesWorked: Number(row[3] ?? 0),
    activityNote: row[4] ?? "",
    offSite: isTrue(row[5]),
    offSiteLocation: row[6] ?? "",
    isWeekendOverride: isTrue(row[7]),
  };
}

export interface StoredTimeEntry {
  entry: TimeEntry;
  rowNumber: number; // numero di riga nel foglio (1-based, header = riga 1)
}

/** Cerca l'eventuale TimeEntry già salvato per una data (YYYY-MM-DD). */
export async function findTimeEntryForDate(
  accessToken: string,
  spreadsheetId: string,
  date: string,
): Promise<StoredTimeEntry | null> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  const index = rows.findIndex((row) => row[0] === date);
  if (index === -1) return null;
  return { entry: parseRow(rows[index]), rowNumber: index + 2 };
}

/**
 * Salva un TimeEntry: aggiorna la riga esistente se rowNumber è passato,
 * altrimenti aggiunge una nuova riga in fondo al tab.
 */
export async function saveTimeEntry(
  accessToken: string,
  spreadsheetId: string,
  entry: TimeEntry,
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
    ],
  ];
  if (rowNumber !== null) {
    await updateValues(accessToken, spreadsheetId, `${SHEET}!A${rowNumber}:H${rowNumber}`, values);
  } else {
    await appendValues(accessToken, spreadsheetId, `${SHEET}!A:H`, values);
  }
}
