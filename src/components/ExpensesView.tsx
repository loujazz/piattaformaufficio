import { useCallback, useState } from "react";
import { ExpenseForm } from "./ExpenseForm";
import { ExpensesSummary } from "./ExpensesSummary";

interface ExpensesViewProps {
  accessToken: string;
  spreadsheetId: string;
}

export function ExpensesView({ accessToken, spreadsheetId }: ExpensesViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <>
      <ExpenseForm accessToken={accessToken} spreadsheetId={spreadsheetId} onSaved={handleSaved} />
      <ExpensesSummary accessToken={accessToken} spreadsheetId={spreadsheetId} refreshKey={refreshKey} />
    </>
  );
}
