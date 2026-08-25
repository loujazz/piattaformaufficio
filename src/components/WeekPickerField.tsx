import { useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { parseISODate, startOfWeekMonday, toISODate } from "../lib/date";
import { MonthCalendarGrid } from "./calendar/MonthCalendarGrid";

interface WeekPickerFieldProps {
  weekStart: Date; // lunedì della settimana selezionata
  onChange: (monday: Date) => void;
}

/**
 * Selettore di settimana. Non usa <input type="week">: non è supportato da Safari
 * né Firefox (degrada a testo libero, niente calendario). Usiamo invece un input
 * data digitabile (qualunque giorno della settimana) più un calendario cliccabile
 * che evidenzia l'intera settimana lun–dom.
 */
export function WeekPickerField({ weekStart, onChange }: WeekPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(weekStart);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className="picker-field" ref={containerRef}>
      <input
        type="date"
        value={toISODate(weekStart)}
        onChange={(e) => {
          if (e.target.value) onChange(startOfWeekMonday(parseISODate(e.target.value)));
        }}
      />
      <button
        type="button"
        className="picker-trigger"
        onClick={() => {
          setViewMonth(weekStart);
          setOpen((o) => !o);
        }}
        aria-label="Apri calendario"
      >
        📅
      </button>
      {open && (
        <div className="picker-popover">
          <MonthCalendarGrid
            viewMonth={viewMonth}
            onNavigateMonth={setViewMonth}
            onSelectDay={(day) => {
              onChange(startOfWeekMonday(day));
              setOpen(false);
            }}
            highlightWeekOf={weekStart}
          />
        </div>
      )}
    </div>
  );
}
