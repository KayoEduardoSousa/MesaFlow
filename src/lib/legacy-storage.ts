export function withoutLegacyUsers<T extends { users?: unknown }>(data: T): Omit<T, "users"> {
  const sanitized = { ...data };
  delete sanitized.users;
  return sanitized;
}
