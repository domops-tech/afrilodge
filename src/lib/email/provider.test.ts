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
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_SECURE;
    delete process.env.EMAIL_FROM;
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

  it('"smtp" lève une erreur explicite si une variable requise manque', async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    // SMTP_HOST volontairement absent.
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "noreply@vd-technologies.com";
    process.env.SMTP_PASSWORD = "secret";
    const { getEmailProvider } = await import("./provider");
    expect(() => getEmailProvider()).toThrow(/SMTP_HOST manquant/);
  });

  it('"smtp" construit un transport sans se connecter (nodemailer.createTransport est paresseux)', async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.migadu.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "noreply@vd-technologies.com";
    process.env.SMTP_PASSWORD = "secret";
    const { getEmailProvider } = await import("./provider");
    expect(() => getEmailProvider()).not.toThrow();
  });
});
