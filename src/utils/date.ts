/**
 * Utilitários compartilhados de data e hora.
 * Regra: armazenar sempre em UTC (ISO/TIMESTAMPTZ) e exibir no fuso horário
 * local do dispositivo do usuário (padrão America/Sao_Paulo apenas se indisponível),
 * no formato dd/MM/yyyy HH:mm:ss.
 */

const TZ_OFFSET_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeUtcTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const raw = String(value).trim();
  if (!raw || DATE_ONLY_REGEX.test(raw)) return raw || null;

  let iso = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  if (!TZ_OFFSET_REGEX.test(iso)) {
    iso = `${iso}Z`;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

export function parseUtcDate(value: string | Date | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  if (DATE_ONLY_REGEX.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  let iso = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  if (!TZ_OFFSET_REGEX.test(iso)) {
    iso = `${iso}Z`;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDeviceOrFallbackTimeZone(): string | undefined {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolved || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export function formatDateTimeBR(value: string | Date | number | null | undefined): string {
  const date = parseUtcDate(value);
  if (!date) return '—';

  const timeZone = getDeviceOrFallbackTimeZone();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    ...(timeZone ? { timeZone } : {}),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hh = map.hour === '24' ? '00' : map.hour;
  return `${map.day}/${map.month}/${map.year} ${hh}:${map.minute}:${map.second}`;
}

export function formatDateBR(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    const [y, m, d] = value.trim().split('-');
    return `${d}/${m}/${y}`;
  }
  const date = parseUtcDate(value);
  if (!date) return '—';

  const timeZone = getDeviceOrFallbackTimeZone();
  return new Intl.DateTimeFormat('pt-BR', {
    ...(timeZone ? { timeZone } : {}),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getLocalDateYMD(dateInput: Date | string = new Date(), timeZone = 'America/Sao_Paulo'): string {
  const date = typeof dateInput === 'string' ? parseUtcDate(dateInput) : dateInput;
  if (!date || Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatBackupFilename(date = new Date()): string {
  const timeZone = getDeviceOrFallbackTimeZone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hh = map.hour === '24' ? '00' : map.hour;
  return `nova-aurora-backup-${map.year}-${map.month}-${map.day}_${hh}-${map.minute}-${map.second}.json`;
}
