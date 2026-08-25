import { appendValues, deleteRow, getSheetIdByTitle, getValues } from "./googleSheetsApi";

export type ReimbursementStatus = "da_richiedere" | "richiesto" | "rimborsato";

export const REIMBURSEMENT_STATUSES: ReimbursementStatus[] = ["da_richiedere", "richiesto", "rimborsato"];

export const REIMBURSEMENT_STATUS_LABELS: Record<ReimbursementStatus, string> = {
  da_richiedere: "Da richiedere",
  richiesto: "Richiesto",
  rimborsato: "Rimborsato",
};

export interface ExpenseEntry {
  date: string; // YYYY-MM-DD
  missionRef: string; // opzionale: data della trasferta a cui si riferisce
  amount: number;
  description: string;
  driveLink: string;
  reimbursementStatus: ReimbursementStatus;
  reimbursedAmount: number;
  rowNumber: number; // numero di riga nel foglio (1-based, header = riga 1)
}

const SHEET = "ExpenseEntries";
const DATA_RANGE = `${SHEET}!A2:G`;

function parseReimbursementStatus(value: string | undefined): ReimbursementStatus {
  return REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus) ? (value as ReimbursementStatus) : "da_richiedere";
}

function parseRow(row: string[], rowNumber: number): ExpenseEntry {
  return {
    date: row[0] ?? "",
    missionRef: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    description: row[3] ?? "",
    driveLink: row[4] ?? "",
    reimbursementStatus: parseReimbursementStatus(row[5]),
    reimbursedAmount: Number(row[6] ?? 0),
    rowNumber,
  };
}

export async function listExpenseEntries(accessToken: string, spreadsheetId: string): Promise<ExpenseEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.map((row, i) => parseRow(row, i + 2)).filter((entry) => entry.date);
}

export async function appendExpenseEntry(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<ExpenseEntry, "rowNumber">,
): Promise<void> {
  await appendValues(accessToken, spreadsheetId, `${SHEET}!A:G`, [
    [
      entry.date,
      entry.missionRef,
      entry.amount,
      entry.description,
      entry.driveLink,
      entry.reimbursementStatus,
      entry.reimbursedAmount,
    ],
  ]);
}

/** Elimina una spesa esistente. */
export async function deleteExpenseEntry(accessToken: string, spreadsheetId: string, rowNumber: number): Promise<void> {
  const sheetId = await getSheetIdByTitle(accessToken, spreadsheetId, SHEET);
  await deleteRow(accessToken, spreadsheetId, sheetId, rowNumber);
}
