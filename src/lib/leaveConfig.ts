import { getValues } from "./googleSheetsApi";

export interface LeaveConfigEntry {
  type: string;
  allocatedTotal: number;
}

const SHEET = "LeaveConfig";
const DATA_RANGE = `${SHEET}!A2:B`;

/** Legge la dotazione annua per tipo di assenza. Sola lettura: LeaveConfig si modifica solo dal foglio. */
export async function listLeaveConfig(accessToken: string, spreadsheetId: string): Promise<LeaveConfigEntry[]> {
  const rows = await getValues(accessToken, spreadsheetId, DATA_RANGE);
  return rows.filter((row) => row[0]).map((row) => ({ type: row[0], allocatedTotal: Number(row[1] ?? 0) }));
}
