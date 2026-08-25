import { appendValues, getValues } from "./googleSheetsApi";

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
}

const SHEET = "ExpenseEntries";
const DATA_RANGE = `${SHEET}!A2:G`;

function parseReimbursementStatus(value: string | undefined): ReimbursementStatus {
  return REIMBURSEMENT_STATUSES.includes(value as ReimbursementStatus) ? (value as ReimbursementStatus) : "da_richiedere";
}

function parseRow(row: string[]): ExpenseEntry {
  return {
    date: row[0] ?? "",
    missionRef: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    description: row[3] ?? "",
    driveLink: row[4] ?? "",
    reimbursementStatus: parseReimbursementStatus(row[5]),
    reimbursedAmount: Number(row[6] ?? 0),
  };
}

export async function listExpenseEntries(accessToken: string, spreadsheetId: string): Promise<ExpenseEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.filter((row) => row[0]).map(parseRow);
}

export async function appendExpenseEntry(accessToken: string, spreadsheetId: string, entry: ExpenseEntry): Promise<void> {
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
