export function parsePriceToCents(input: string): number | null {
  const value = input.trim();
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;

  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
