import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), transaction: vi.fn(), release: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ prisma: { booking: { findUniqueOrThrow: mocks.find }, $transaction: mocks.transaction } }));
vi.mock("@/lib/payments/simulated", () => ({ getPaymentProvider: () => ({ release: mocks.release }), buildSimulatedWebhookRequest: vi.fn() }));
vi.mock("@/lib/payments/webhook-handler", () => ({ processPaymentWebhook: vi.fn() }));
import { confirmArrivalAndRelease } from "./release";
it("bloque l'appel direct de libération avant l'arrivée sans aucune écriture ni appel PSP", async () => {
  mocks.find.mockResolvedValue({ checkIn: new Date(Date.now() + 8 * 86400000), status: "PAID", payment: { status: "HELD", providerIntentRef: "intent" } });
  await expect(confirmArrivalAndRelease("booking")).rejects.toThrow("Arrivée non autorisée");
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
});
