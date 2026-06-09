export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-IN").format(number);
}

export function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(number);
}

export function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number.toFixed(1)}%`;
}

export function formatDurationMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (number < 1000) return `${Math.round(number)} ms`;
  const seconds = number / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function last28Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end)
  };
}

export function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

export function shortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function safeRows(payload) {
  return Array.isArray(payload?.rows) ? payload.rows : [];
}
