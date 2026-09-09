import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getEmailProvider()` mémorise son instance dans une variable de module
 * (voir provider.ts) : chaque test réimporte le module après
 * `vi.resetModules()` pour repartir d'un état neuf, sinon seul le premier
 * `EMAIL_PROVIDER` lu compterait pour toute la suite.
 */
describe("getEmailProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.EMAIL_PROVIDER;
  });

  it("lève une erreur explicite sur une valeur inconnue, sans repli silencieux", async () => {
    process.env.EMAIL_PROVIDER = "bogus";
    const { getEmailProvider } = await import("./provider");
    expect(() => getEmailProvider()).toThrow(/EMAIL_PROVIDER="bogus"/);
  });

  it("lève une erreur si la variable est absente — même règle que src/lib/sms/provider.ts", async () => {
    const { getEmailProvider } = await import("./provider");
    expect(() => getEmailProvider()).toThrow(/EMAIL_PROVIDER/);
  });

  it('accepte "console" et journalise le dernier message par destinataire', async () => {
    process.env.EMAIL_PROVIDER = "console";
    const { getEmailProvider, __getLastConsoleEmail } = await import("./provider");

    await getEmailProvider().send({ to: "a@b.com", subject: "Sujet", body: "Corps du message" });

    expect(__getLastConsoleEmail("a@b.com")).toBe("Corps du message");
  });
});
