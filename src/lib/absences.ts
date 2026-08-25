import { appendValues, deleteRow, getSheetIdByTitle, getValues } from "./googleSheetsApi";

export type AbsenceType = "ferie" | "permesso_generico" | "permesso_formazione" | "malattia" | "altro";

export const ABSENCE_TYPES: AbsenceType[] = ["ferie", "permesso_generico", "permesso_formazione", "malattia", "altro"];

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  ferie: "Ferie",
  permesso_generico: "Permesso generico",
  permesso_formazione: "Permesso formazione",
  malattia: "Malattia",
  altro: "Altro",
};

export interface AbsenceEntry {
  date: string; // YYYY-MM-DD
  type: string;
  amount: number;
  note: string;
  rowNumber: number; // numero di riga nel foglio (1-based, header = riga 1)
}

const SHEET = "AbsenceEntries";
const DATA_RANGE = `${SHEET}!A2:D`;

function parseRow(row: string[], rowNumber: number): AbsenceEntry {
  return {
    date: row[0] ?? "",
    type: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    note: row[3] ?? "",
    rowNumber,
  };
}

export async function listAbsenceEntries(accessToken: string, spreadsheetId: string): Promise<AbsenceEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.map((row, i) => parseRow(row, i + 2)).filter((entry) => entry.date);
}

/** Aggiunge una nuova assenza. Non esiste un vincolo di unicità per data: nello stesso giorno
 * possono coesistere più assenze di tipo diverso (es. permesso ore + malattia). */
export async function appendAbsenceEntry(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<AbsenceEntry, "rowNumber">,
): Promise<void> {
  await appendValues(accessToken, spreadsheetId, `${SHEET}!A:D`, [[entry.date, entry.type, entry.amount, entry.note]]);
}

/** Elimina un'assenza esistente. */
export async function deleteAbsenceEntry(accessToken: string, spreadsheetId: string, rowNumber: number): Promise<void> {
  const sheetId = await getSheetIdByTitle(accessToken, spreadsheetId, SHEET);
  await deleteRow(accessToken, spreadsheetId, sheetId, rowNumber);
}
