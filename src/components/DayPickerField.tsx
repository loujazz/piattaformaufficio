import { useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { parseISODate, toISODate } from "../lib/date";
import { MonthCalendarGrid } from "./calendar/MonthCalendarGrid";

interface DayPickerFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  id?: string;
}

/** Campo data: input nativo digitabile + bottone che apre un calendario cliccabile, per non dipendere dal supporto (incostante tra browser) del selettore nativo. */
export function DayPickerField({ value, onChange, id }: DayPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseISODate(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const selectedDate = value ? parseISODate(value) : undefined;

  return (
    <div className="picker-field" ref={containerRef}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
      <button
        type="button"
        className="picker-trigger"
        onClick={() => {
          setViewMonth(selectedDate ?? new Date());
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
              onChange(toISODate(day));
              setOpen(false);
            }}
            selectedDay={selectedDate}
          />
        </div>
      )}
    </div>
  );
}
