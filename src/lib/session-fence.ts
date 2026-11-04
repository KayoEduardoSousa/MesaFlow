export async function awaitForSession<T>(
  requestedUserId: string,
  getCurrentUserId: () => string | null,
  operation: () => PromiseLike<T>,
): Promise<{ isCurrent: boolean; value: T }> {
  const value = await operation();
  return {
    isCurrent: getCurrentUserId() === requestedUserId,
    value,
  };
}
