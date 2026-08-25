// Chiamate dirette alle Google Sheets API v4 dal client, usando l'access
// token OAuth. Nessun backend: ogni funzione qui è una fetch autenticata.

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export class SheetsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SheetsApiError";
    this.status = status;
  }
}

async function sheetsFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new SheetsApiError(`Google Sheets API ha risposto ${res.status}: ${body}`, res.status);
  }
  return res;
}

export interface SpreadsheetMeta {
  title: string;
  sheetTitles: string[];
}

/** Recupera titolo del foglio e nomi dei tab, per verificare il collegamento. */
export async function getSpreadsheetMeta(accessToken: string, spreadsheetId: string): Promise<SpreadsheetMeta> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title`;
  const res = await sheetsFetch(url, accessToken);
  const data = (await res.json()) as {
    properties: { title: string };
    sheets: { properties: { title: string } }[];
  };
  return {
    title: data.properties.title,
    sheetTitles: data.sheets.map((s) => s.properties.title),
  };
}

/** Legge un range (es. "TimeEntries!A1:H1") come matrice di celle. */
export async function getValues(accessToken: string, spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await sheetsFetch(url, accessToken);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

export type CellValue = string | number | boolean;

/** Aggiunge una nuova riga in fondo al tab (es. range "TimeEntries!A:H"). */
export async function appendValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: CellValue[][],
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await sheetsFetch(url, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
}

/** Sovrascrive un range esistente (es. una riga già presente da aggiornare). */
export async function updateValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: CellValue[][],
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await sheetsFetch(url, accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
}
