export function formatNumberInputValue(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return value;
}
