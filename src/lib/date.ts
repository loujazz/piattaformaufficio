export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Data odierna in formato YYYY-MM-DD nel fuso orario locale del browser. */
export function todayLocalISODate(): string {
  return toISODate(new Date());
}

/** Ora corrente in formato HH:MM nel fuso orario locale del browser, per il check-in/out rapido. */
export function nowLocalHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Costruisce una Date a mezzanotte locale da una stringa YYYY-MM-DD (evita problemi di fuso orario di `new Date(string)`). */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Lunedì della settimana contenente la data data. */
export function startOfWeekMonday(date: Date): Date {
  const day = date.getDay(); // 0 = domenica ... 6 = sabato
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

const GIORNI_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI_IT = [
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

export function dayLabelIt(date: Date): string {
  return GIORNI_IT[date.getDay()];
}

export function monthLabelIt(date: Date): string {
  return `${MESI_IT[date.getMonth()]} ${date.getFullYear()}`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Domenica di Pasqua per l'anno dato (algoritmo di Gauss, calendario gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const holidayCache = new Map<number, Set<string>>();

/** Insieme (in formato YYYY-MM-DD) delle festività nazionali italiane per un anno. */
export function italianHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const fixed = [
    [1, 1], // Capodanno
    [1, 6], // Epifania
    [4, 25], // Liberazione
    [5, 1], // Festa dei lavoratori
    [6, 2], // Festa della Repubblica
    [8, 15], // Ferragosto
    [11, 1], // Ognissanti
    [12, 8], // Immacolata Concezione
    [12, 25], // Natale
    [12, 26], // Santo Stefano
  ];

  const holidays = new Set<string>(fixed.map(([month, day]) => toISODate(new Date(year, month - 1, day))));

  const easter = easterSunday(year);
  const easterMonday = addDays(easter, 1); // Pasquetta
  holidays.add(toISODate(easterMonday));

  holidayCache.set(year, holidays);
  return holidays;
}

export function isItalianHoliday(date: Date): boolean {
  return italianHolidays(date.getFullYear()).has(toISODate(date));
}

/** Giorno lavorativo di default: non weekend e non festività nazionale. */
export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isItalianHoliday(date);
}
