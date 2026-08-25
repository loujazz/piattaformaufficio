import { ABSENCE_TYPE_LABELS, listAbsenceEntries, type AbsenceType } from "./absences";
import { dayLabelIt, daysInMonth, monthLabelIt, toISODate } from "./date";
import { listExpenseEntries, REIMBURSEMENT_STATUS_LABELS } from "./expenses";
import { clearValues, type CellValue, updateValues } from "./googleSheetsApi";
import { formatMinutes, listTimeEntries } from "./timeEntries";

const SHEET = "ReportTemplate";
const CLEAR_RANGE = `${SHEET}!A1:Z500`;

export interface ReportOptions {
  includeAbsences: boolean;
  includeExpenses: boolean;
}

/** Rigenera il tab ReportTemplate con le ore/giorno del mese/anno scelto, includendo assenze e spese solo se richiesto. */
export async function generateMonthlyReport(
  accessToken: string,
  spreadsheetId: string,
  year: number,
  month: number, // 1-12
  options: ReportOptions,
): Promise<void> {
  const monthDate = new Date(year, month - 1, 1);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;

  const [timeEntries, absenceEntries, expenseEntries] = await Promise.all([
    listTimeEntries(accessToken, spreadsheetId),
    options.includeAbsences ? listAbsenceEntries(accessToken, spreadsheetId) : Promise.resolve([]),
    options.includeExpenses ? listExpenseEntries(accessToken, spreadsheetId) : Promise.resolve([]),
  ]);

  const timeByDate = new Map(timeEntries.map((e) => [e.date, e]));
  const monthAbsences = absenceEntries.filter((e) => e.date.startsWith(monthPrefix));
  const monthExpenses = expenseEntries.filter((e) => e.date.startsWith(monthPrefix));

  const rows: CellValue[][] = [];
  rows.push([`Report presenze — ${monthLabelIt(monthDate)}`]);
  rows.push([]);
  rows.push(["Data", "Giorno", "Entrata", "Uscita", "Ore", "Attività", "Fuori sede"]);

  let totalMinutes = 0;
  for (let day = 1; day <= daysInMonth(monthDate); day++) {
    const date = new Date(year, month - 1, day);
    const iso = toISODate(date);
    const entry = timeByDate.get(iso);
    if (entry) totalMinutes += entry.minutesWorked;
    rows.push([
      iso,
      dayLabelIt(date),
      entry?.checkIn ?? "",
      entry?.checkOut ?? "",
      entry ? formatMinutes(entry.minutesWorked) : "",
      entry?.activityNote ?? "",
      entry?.offSite ? entry.offSiteLocation : "",
    ]);
  }

  rows.push([]);
  rows.push(["Totale ore mese", formatMinutes(totalMinutes)]);

  if (options.includeAbsences) {
    rows.push([]);
    rows.push(["Assenze del mese"]);
    rows.push(["Data", "Tipo", "Quantità", "Note"]);
    if (monthAbsences.length === 0) {
      rows.push(["Nessuna assenza registrata"]);
    } else {
      for (const a of monthAbsences) {
        rows.push([a.date, ABSENCE_TYPE_LABELS[a.type as AbsenceType] ?? a.type, a.amount, a.note]);
      }
    }
  }

  if (options.includeExpenses) {
    rows.push([]);
    rows.push(["Spese del mese"]);
    rows.push(["Data", "Missione", "Importo", "Descrizione", "Stato", "Rimborsato"]);
    if (monthExpenses.length === 0) {
      rows.push(["Nessuna spesa registrata"]);
    } else {
      for (const e of monthExpenses) {
        rows.push([
          e.date,
          e.missionRef,
          e.amount,
          e.description,
          REIMBURSEMENT_STATUS_LABELS[e.reimbursementStatus],
          e.reimbursedAmount,
        ]);
      }
    }
    const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalReimbursed = monthExpenses.reduce((sum, e) => sum + e.reimbursedAmount, 0);
    rows.push([]);
    rows.push(["Totale sostenuto", totalSpent]);
    rows.push(["Totale rimborsato", totalReimbursed]);
    rows.push(["Da ricevere", totalSpent - totalReimbursed]);
  }

  await clearValues(accessToken, spreadsheetId, CLEAR_RANGE);
  await updateValues(accessToken, spreadsheetId, `${SHEET}!A1`, rows);
}

/** URL dell'endpoint export nativo di Google Sheets per scaricare un singolo tab come PDF. */
export function buildPdfExportUrl(spreadsheetId: string, sheetId: number): string {
  const params = new URLSearchParams({
    format: "pdf",
    gid: String(sheetId),
    size: "A4",
    portrait: "true",
    fitw: "true",
    gridlines: "true",
    printtitle: "false",
    sheetnames: "false",
    pagenumbers: "false",
  });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params.toString()}`;
}
