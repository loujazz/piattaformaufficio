import { ABSENCE_TYPE_LABELS, listAbsenceEntries, type AbsenceType } from "./absences";
import { dayLabelIt, daysInMonth, monthLabelIt, toISODate } from "./date";
import { listExpenseEntries, REIMBURSEMENT_STATUS_LABELS } from "./expenses";
import { clearValues, type CellValue, updateValues } from "./googleSheetsApi";
import { formatMinutes, groupTimeEntriesByDate, listTimeEntries, summarizeDay } from "./timeEntries";

const SHEET = "ReportTemplate";
const CLEAR_RANGE = `${SHEET}!A1:Z500`;

export interface ReportOptions {
  includeExpenses: boolean;
}

/** Rigenera il tab ReportTemplate con le ore/giorno del mese/anno scelto. Le assenze sono sempre incluse nella riga del giorno; le spese solo se richiesto. */
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
    listAbsenceEntries(accessToken, spreadsheetId),
    options.includeExpenses ? listExpenseEntries(accessToken, spreadsheetId) : Promise.resolve([]),
  ]);

  const timeByDate = groupTimeEntriesByDate(timeEntries);
  const monthAbsences = absenceEntries.filter((e) => e.date.startsWith(monthPrefix));
  const monthExpenses = expenseEntries.filter((e) => e.date.startsWith(monthPrefix));

  const absencesByDate = new Map<string, string>();
  for (const a of monthAbsences) {
    const label = ABSENCE_TYPE_LABELS[a.type as AbsenceType] ?? a.type;
    absencesByDate.set(a.date, absencesByDate.has(a.date) ? `${absencesByDate.get(a.date)}; ${label}` : label);
  }

  const rows: CellValue[][] = [];
  rows.push([`Report presenze — ${monthLabelIt(monthDate)}`]);
  rows.push([]);
  rows.push(["Data", "Giorno", "Entrata", "Uscita", "Ore", "Attività", "Fuori sede", "Assenza"]);

  let totalMinutes = 0;
  for (let day = 1; day <= daysInMonth(monthDate); day++) {
    const date = new Date(year, month - 1, day);
    const iso = toISODate(date);
    const daySegments = timeByDate.get(iso) ?? [];
    const summary = summarizeDay(daySegments);
    totalMinutes += summary.totalMinutes;
    const activityNotes = daySegments.map((s) => s.activityNote).filter(Boolean).join("; ");
    const offSiteLocations = daySegments
      .filter((s) => s.offSite)
      .map((s) => s.offSiteLocation)
      .filter(Boolean)
      .join("; ");
    rows.push([
      iso,
      dayLabelIt(date),
      summary.firstCheckIn,
      summary.lastCheckOut,
      daySegments.length > 0 ? formatMinutes(summary.totalMinutes) : "",
      activityNotes,
      offSiteLocations,
      absencesByDate.get(iso) ?? "",
    ]);
  }

  rows.push([]);
  rows.push(["Totale ore mese", formatMinutes(totalMinutes)]);

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
