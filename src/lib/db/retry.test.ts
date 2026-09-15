import { it, expect, vi } from 'vitest';
import { retryTransaction } from './retry';
it('reprend une transaction annulée pour concurrence, sans répéter une opération réussie', async () => {
  const operation = vi.fn().mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValue('reserved');
  expect(await retryTransaction(operation)).toBe('reserved');
  expect(operation).toHaveBeenCalledTimes(2);
});
it('ne masque pas les erreurs métier ou les conflits persistants', async () => {
  const unique = vi.fn().mockRejectedValue({ code: 'P2002' });
  await expect(retryTransaction(unique)).rejects.toEqual({ code: 'P2002' });
  expect(unique).toHaveBeenCalledTimes(1);
  const conflict = vi.fn().mockRejectedValue({ code: 'P2034' });
  await expect(retryTransaction(conflict)).rejects.toEqual({ code: 'P2034' });
  expect(conflict).toHaveBeenCalledTimes(3);
});
