import { appendValues, getValues } from "./googleSheetsApi";

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
}

const SHEET = "AbsenceEntries";
const DATA_RANGE = `${SHEET}!A2:D`;

function parseRow(row: string[]): AbsenceEntry {
  return {
    date: row[0] ?? "",
    type: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    note: row[3] ?? "",
  };
}

export async function listAbsenceEntries(accessToken: string, spreadsheetId: string): Promise<AbsenceEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.filter((row) => row[0]).map(parseRow);
}

/** Aggiunge una nuova assenza. Non esiste un vincolo di unicità per data: nello stesso giorno
 * possono coesistere più assenze di tipo diverso (es. permesso ore + malattia). */
export async function appendAbsenceEntry(accessToken: string, spreadsheetId: string, entry: AbsenceEntry): Promise<void> {
  await appendValues(accessToken, spreadsheetId, `${SHEET}!A:D`, [[entry.date, entry.type, entry.amount, entry.note]]);
}
