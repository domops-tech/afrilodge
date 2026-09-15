/** Retry only transactions PostgreSQL has rolled back for concurrency conflicts.
 * Callbacks must contain database operations only (no SMS or PSP side effects).
 */
export function isTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: string; meta?: { code?: string }; cause?: unknown };
  return details.code === 'P2034' || ['40001', '40P01'].includes(details.code ?? '') ||
    ['40001', '40P01'].includes(details.meta?.code ?? '') ||
    (details.cause !== undefined && isTransactionConflict(details.cause));
}

export async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) { if (attempt >= 2 || !isTransactionConflict(error)) throw error; }
  }
}
