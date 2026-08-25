import { useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { MonthGridPicker } from "./calendar/MonthGridPicker";

interface MonthPickerFieldProps {
  monthStart: Date; // primo giorno del mese selezionato
  onChange: (date: Date) => void;
}

function toMonthInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPickerField({ monthStart, onChange }: MonthPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(monthStart.getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className="picker-field" ref={containerRef}>
      <input
        type="month"
        value={toMonthInputValue(monthStart)}
        onChange={(e) => {
          if (!e.target.value) return;
          const [y, m] = e.target.value.split("-").map(Number);
          onChange(new Date(y, m - 1, 1));
        }}
      />
      <button
        type="button"
        className="picker-trigger"
        onClick={() => {
          setViewYear(monthStart.getFullYear());
          setOpen((o) => !o);
        }}
        aria-label="Apri calendario"
      >
        📅
      </button>
      {open && (
        <div className="picker-popover">
          <MonthGridPicker
            viewYear={viewYear}
            onNavigateYear={setViewYear}
            onSelectMonth={(y, m) => {
              onChange(new Date(y, m - 1, 1));
              setOpen(false);
            }}
            selected={monthStart}
          />
        </div>
      )}
    </div>
  );
}
