interface MonthGridPickerProps {
  viewYear: number;
  onNavigateYear: (year: number) => void;
  onSelectMonth: (year: number, month: number) => void; // month: 1-12
  selected: Date;
}

const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function MonthGridPicker({ viewYear, onNavigateYear, onSelectMonth, selected }: MonthGridPickerProps) {
  return (
    <div className="calendar-grid">
      <div className="calendar-grid-header">
        <button type="button" onClick={() => onNavigateYear(viewYear - 1)} aria-label="Anno precedente">
          ‹
        </button>
        <span>{viewYear}</span>
        <button type="button" onClick={() => onNavigateYear(viewYear + 1)} aria-label="Anno successivo">
          ›
        </button>
      </div>
      <div className="calendar-grid-months">
        {MESI_BREVI.map((label, i) => {
          const month = i + 1;
          const isSelected = selected.getFullYear() === viewYear && selected.getMonth() + 1 === month;
          return (
            <button
              type="button"
              key={label}
              className={isSelected ? "selected" : undefined}
              onClick={() => onSelectMonth(viewYear, month)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
