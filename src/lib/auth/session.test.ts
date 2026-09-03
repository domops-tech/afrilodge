import { beforeAll, describe, expect, it } from "vitest";
import { __testing } from "./session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-do-not-use-in-production";
});

describe("session token encode/decode", () => {
  it("décode un token qu'il vient d'encoder", () => {
    const payload = {
      kind: "user" as const,
      userId: "user_123",
      role: "OWNER" as const,
      exp: Date.now() + 60_000,
    };

    const token = __testing.encode(payload);
    const decoded = __testing.decode(token);

    expect(decoded).toEqual(payload);
  });

  it("refuse un token expiré", () => {
    const token = __testing.encode({
      kind: "guest",
      guestSessionId: "gs_1",
      exp: Date.now() - 1000,
    });

    expect(__testing.decode(token)).toBeNull();
  });

  it("refuse un token dont la signature a été altérée", () => {
    const token = __testing.encode({
      kind: "guest",
      guestSessionId: "gs_1",
      exp: Date.now() + 60_000,
    });
    const [payloadB64] = token.split(".");
    const tampered = `${payloadB64}.invalidsignature`;

    expect(__testing.decode(tampered)).toBeNull();
  });

  it("refuse un payload altéré même si la structure du token est correcte", () => {
    const token = __testing.encode({
      kind: "user",
      userId: "user_123",
      role: "OWNER",
      exp: Date.now() + 60_000,
    });
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ kind: "user", userId: "attacker", role: "ADMIN", exp: Date.now() + 60_000 })
    ).toString("base64url");

    expect(__testing.decode(`${forgedPayload}.${signature}`)).toBeNull();
  });
});
