import type { Num } from './types';

// Страница только форматирует числа. Суммы и курсы считает база.
const moneyFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const qtyFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

export function toNum(v: Num | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  return Number(v);
}

// NULL не превращаем в 0: вернём null, и вызывающий код покажет «Kurs niedostępny».
export function money(v: Num | null | undefined): string | null {
  const n = toNum(v);
  return n === null ? null : moneyFmt.format(n);
}

export function rate(v: Num | null | undefined): string | null {
  const n = toNum(v);
  return n === null ? null : rateFmt.format(n);
}

export function qty(v: Num | null | undefined): string {
  const n = toNum(v);
  return n === null ? '—' : qtyFmt.format(n);
}

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// Разбор даты из базы: 'YYYY-MM-DD' -> год и номер месяца (0–11).
export function parsePeriod(s: string): { year: number; month0: number } {
  const [y, m] = s.slice(0, 10).split('-').map(Number);
  return { year: y, month0: m - 1 };
}

export function periodKey(year: number, month0: number): string {
  // Date.UTC сам переносит месяц за пределы года: месяц 12 становится январём следующего года.
  const d = new Date(Date.UTC(year, month0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function monthLabel(s: string): string {
  const { year, month0 } = parsePeriod(s);
  return `${MONTHS[month0]} ${year}`;
}

// Текущий месяц по времени пользователя, в формате первого дня месяца.
export function currentPeriod(): string {
  const d = new Date();
  return periodKey(d.getFullYear(), d.getMonth());
}

// Окно месяцев вокруг центра: back месяцев назад и forward месяцев вперёд, по возрастанию.
export function monthsAround(centerKey: string, back: number, forward: number): string[] {
  const { year, month0 } = parsePeriod(centerKey);
  const out: string[] = [];
  for (let i = -back; i <= forward; i++) {
    out.push(periodKey(year, month0 + i));
  }
  return out;
}

// Закрытие доступно с первого дня месяца, следующего за месяцем счёта, по UTC.
export function closeAllowed(periodStr: string): boolean {
  const { year, month0 } = parsePeriod(periodStr);
  return Date.now() >= Date.UTC(year, month0 + 1, 1);
}

// Дата и время событий: dd.mm.yyyy HH:mm по времени пользователя.
export function dateTimePl(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
