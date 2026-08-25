import { useMemo } from "react";
import {
  addDays,
  addMonths,
  dayLabelIt,
  isItalianHoliday,
  isSameDay,
  isWeekend,
  monthLabelIt,
  startOfCalendarGrid,
  startOfWeekMonday,
} from "../../lib/date";

interface MonthCalendarGridProps {
  viewMonth: Date;
  onNavigateMonth: (next: Date) => void;
  onSelectDay: (day: Date) => void;
  /** Giorno singolo evidenziato (modalità "giorno"). */
  selectedDay?: Date;
  /** Se presente, evidenzia l'intera settimana (lun-dom) a cui appartiene (modalità "settimana"). */
  highlightWeekOf?: Date;
}

const GIORNI_HEADER = ["L", "M", "M", "G", "V", "S", "D"];

export function MonthCalendarGrid({
  viewMonth,
  onNavigateMonth,
  onSelectDay,
  selectedDay,
  highlightWeekOf,
}: MonthCalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfCalendarGrid(viewMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [viewMonth]);

  const highlightedWeekStart = highlightWeekOf ? startOfWeekMonday(highlightWeekOf) : null;

  return (
    <div className="calendar-grid">
      <div className="calendar-grid-header">
        <button type="button" onClick={() => onNavigateMonth(addMonths(viewMonth, -1))} aria-label="Mese precedente">
          ‹
        </button>
        <span>{monthLabelIt(viewMonth)}</span>
        <button type="button" onClick={() => onNavigateMonth(addMonths(viewMonth, 1))} aria-label="Mese successivo">
          ›
        </button>
      </div>
      <div className="calendar-grid-weekdays">
        {GIORNI_HEADER.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="calendar-grid-days">
        {days.map((day) => {
          const outsideMonth = day.getMonth() !== viewMonth.getMonth();
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
          const inHighlightedWeek = highlightedWeekStart
            ? day >= highlightedWeekStart && day < addDays(highlightedWeekStart, 7)
            : false;
          const nonWorking = isWeekend(day) || isItalianHoliday(day);
          const classes = [
            outsideMonth && "outside",
            isSelected && "selected",
            inHighlightedWeek && "in-week",
            nonWorking && "non-working",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              type="button"
              key={day.toISOString()}
              className={classes || undefined}
              onClick={() => onSelectDay(day)}
              title={dayLabelIt(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
