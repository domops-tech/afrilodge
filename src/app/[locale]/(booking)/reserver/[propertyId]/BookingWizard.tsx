"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { nightsInRange, isoDate } from "@/lib/booking/nights";
import {
  checkAvailabilityAction,
  requestGuestOtpAction,
  confirmBookingAction,
  type DatesState,
  type IdentityState,
} from "./actions";

function errorKey(message: string | undefined): string {
  switch (message) {
    case "invalid_range":
      return "invalidRange";
    case "too_many_guests":
      return "tooManyGuests";
    case "unavailable":
      return "unavailableRange";
    case "rate_limited":
      return "rateLimited";
    case "expired":
      return "expiredCode";
    case "too_many_attempts":
      return "tooManyAttempts";
    case "not_found":
    case "mismatch":
      return "invalidCode";
    default:
      return "invalid";
  }
}

/**
 * Assistant client à trois étapes (dates → identité → code), même principe
 * que OtpLoginForm : l'état du tunnel vit côté client (pas de compte pour
 * le voyageur, CDC §6.2), chaque étape soumet à une Server Action distincte
 * revérifiée côté serveur — voir ./actions.ts, jamais fait confiance au
 * seul contrôle client ci-dessous.
 */
export function BookingWizard({
  propertyId,
  locale,
  maxGuests,
  minDate,
  unavailableDates,
}: {
  propertyId: string;
  locale: string;
  maxGuests: number;
  minDate: string;
  unavailableDates: string[];
}) {
  const t = useTranslations("booking");
  const unavailable = useMemo(() => new Set(unavailableDates), [unavailableDates]);

  const [step, setStep] = useState<"dates" | "identity" | "code">("dates");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("1");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");

  const clientConflict = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (!(end > start)) return false;
    return nightsInRange(start, end).some((night) => unavailable.has(isoDate(night)));
  }, [checkIn, checkOut, unavailable]);

  const [datesState, datesAction, datesPending] = useActionState(
    async (prev: DatesState, formData: FormData) => {
      const result = await checkAvailabilityAction(prev, formData);
      if (result.status === "ok") setStep("identity");
      return result;
    },
    { status: "idle" as const }
  );

  const [identityState, identityAction, identityPending] = useActionState(
    async (prev: IdentityState, formData: FormData) => {
      const result = await requestGuestOtpAction(prev, formData);
      if (result.status === "sent") setStep("code");
      return result;
    },
    { status: "idle" as const }
  );

  const [confirmState, confirmAction, confirmPending] = useActionState(confirmBookingAction, {
    status: "idle" as const,
  });

  if (step === "dates") {
    return (
      <form action={datesAction} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="propertyId" value={propertyId} />
        <Field
          id="checkIn"
          name="checkIn"
          type="date"
          label={t("checkInLabel")}
          min={minDate}
          required
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
        />
        <Field
          id="checkOut"
          name="checkOut"
          type="date"
          label={t("checkOutLabel")}
          min={checkIn || minDate}
          required
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
        <Field
          id="guests"
          name="guests"
          type="number"
          min={1}
          max={maxGuests}
          label={t("guestsLabel")}
          required
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />
        {clientConflict ? <p className="text-sm text-danger">{t("unavailableRange")}</p> : null}
        {datesState.status === "error" ? (
          <p className="text-sm text-danger">{t(errorKey(datesState.message))}</p>
        ) : null}
        <Button type="submit" disabled={datesPending || clientConflict}>
          {t("nextCta")}
        </Button>
      </form>
    );
  }

  if (step === "identity") {
    return (
      <form action={identityAction} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="checkIn" value={checkIn} />
        <input type="hidden" name="checkOut" value={checkOut} />
        <input type="hidden" name="guests" value={guests} />
        <p className="text-sm text-muted">{t("summaryRange", { checkIn, checkOut, guests: Number(guests) })}</p>
        <Field
          id="fullName"
          name="fullName"
          label={t("fullNameLabel")}
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          id="phone"
          name="phone"
          label={t("phoneLabel")}
          placeholder={t("phonePlaceholder")}
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {identityState.status === "error" ? (
          <p className="text-sm text-danger">{t(errorKey(identityState.message))}</p>
        ) : null}
        <Button type="submit" disabled={identityPending}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form action={confirmAction} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t("codeSent", { phone })}</p>
      <Field
        id="code"
        name="code"
        label={t("codeLabel")}
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
      />
      {confirmState.status === "error" ? (
        <p className="text-sm text-danger">{t(errorKey(confirmState.message))}</p>
      ) : null}
      <Button type="submit" disabled={confirmPending}>
        {t("confirmCta")}
      </Button>
    </form>
  );
}
