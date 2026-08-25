import { useCallback, useState } from "react";
import { AbsenceForm } from "./AbsenceForm";
import { LeaveBalances } from "./LeaveBalances";

interface AbsencesViewProps {
  accessToken: string;
  spreadsheetId: string;
}

export function AbsencesView({ accessToken, spreadsheetId }: AbsencesViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <>
      <AbsenceForm accessToken={accessToken} spreadsheetId={spreadsheetId} onSaved={handleSaved} />
      <LeaveBalances accessToken={accessToken} spreadsheetId={spreadsheetId} refreshKey={refreshKey} />
    </>
  );
}
