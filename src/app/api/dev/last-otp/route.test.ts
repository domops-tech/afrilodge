import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const call = () => GET(new NextRequest("http://localhost/api/dev/last-otp?phone=%2B2290100000000"));

describe("/api/dev/last-otp", () => {
  afterEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.ENABLE_DEV_OTP_ENDPOINT;
  });

  it("répond 404 avec le fournisseur console seul", async () => {
    process.env.SMS_PROVIDER = "console";
    expect((await call()).status).toBe(404);
  });

  it("répond 404 sans fournisseur console, même avec l'indicateur", async () => {
    process.env.ENABLE_DEV_OTP_ENDPOINT = "1";
    expect((await call()).status).toBe(404);
  });

  it("répond avec les deux conditions réunies", async () => {
    process.env.SMS_PROVIDER = "console";
    process.env.ENABLE_DEV_OTP_ENDPOINT = "1";
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: null });
  });
});
