import { useCallback, useState } from "react";
import { getSpreadsheetMeta, SheetsApiError } from "../lib/googleSheetsApi";
import { buildPdfExportUrl, generateMonthlyReport } from "../lib/report";

interface ExportViewProps {
  accessToken: string;
  spreadsheetId: string;
}

const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export function ExportView({ accessToken, spreadsheetId }: ExportViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setPdfUrl(null);
    try {
      await generateMonthlyReport(accessToken, spreadsheetId, year, month, { includeExpenses });
      const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
      const reportSheet = meta.sheets.find((s) => s.title === "ReportTemplate");
      if (!reportSheet) {
        setError('Tab "ReportTemplate" non trovato nel foglio.');
        return;
      }
      setPdfUrl(buildPdfExportUrl(spreadsheetId, reportSheet.sheetId));
    } catch (err) {
      setError(err instanceof SheetsApiError ? err.message : "Errore nella generazione del report.");
    } finally {
      setGenerating(false);
    }
  }, [accessToken, spreadsheetId, year, month, includeExpenses]);

  return (
    <section className="export-view">
      <h2>Export report</h2>
      <p className="hint">Genera il report del mese scelto nel tab "ReportTemplate" del foglio e scaricalo in PDF.</p>

      <label className="field">
        Mese
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        Anno
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={includeExpenses} onChange={(e) => setIncludeExpenses(e.target.checked)} />
        Includi spese del mese
      </label>

      {error && <p className="error">{error}</p>}

      <button onClick={handleGenerate} disabled={generating}>
        {generating ? "Generazione in corso..." : "Genera report"}
      </button>

      {pdfUrl && (
        <p className="success">
          Report generato.{" "}
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            Scarica PDF
          </a>
        </p>
      )}
    </section>
  );
}
