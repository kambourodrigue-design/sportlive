// Dates calculées dans le fuseau horaire de l'appareil de l'utilisateur (et non en UTC)
const pad = (n: number) => String(n).padStart(2, '0');
const DAY_LABELS = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'];

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface StripDay {
  label: string;
  dateStr: string;
  fullDate: string;
  isToday?: boolean;
}

// 7 jours : 3 avant, aujourd'hui, 3 après
export function getWeekStrip(base: Date = new Date()): StripDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (i - 3));
    return {
      label: i === 3 ? 'AJD' : DAY_LABELS[d.getDay()],
      dateStr: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`,
      fullDate: toLocalISODate(d),
      isToday: i === 3,
    };
  });
}
