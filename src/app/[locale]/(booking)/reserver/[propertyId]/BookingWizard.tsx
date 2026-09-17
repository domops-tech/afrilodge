"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { nightsInRange, isoDate } from "@/lib/booking/nights";
import { checkAvailabilityAction, requestGuestOtpAction, confirmBookingAction, type DatesState, type IdentityState } from "./actions";

function errorKey(message: string | undefined): string {
  switch (message) {
    case "invalid_range": return "invalidRange";
    case "too_many_guests": return "tooManyGuests";
    case "unavailable": return "unavailableRange";
    case "rate_limited": return "rateLimited";
    case "expired": return "expiredCode";
    case "too_many_attempts": return "tooManyAttempts";
    case "not_found": case "mismatch": return "invalidCode";
    default: return "invalid";
  }
}

export function BookingWizard({ propertyId, locale, property, maxGuests, minDate, unavailableDates, initialCheckIn = "", initialCheckOut = "", initialGuests = "1" }: {
  propertyId: string;
  locale: string;
  property: { title: string; neighborhood: string; city: string; pricePerNight: number };
  maxGuests: number;
  minDate: string;
  unavailableDates: string[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: string;
}) {
  const t = useTranslations("booking");
  const f = useFormatter();
  const unavailable = useMemo(() => new Set(unavailableDates), [unavailableDates]);
  const [step, setStep] = useState<"dates" | "identity" | "code">("dates");
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const stayNights = useMemo(() => {
    if (!checkIn || !checkOut) return [];
    const start = new Date(`${checkIn}T00:00:00.000Z`);
    const end = new Date(`${checkOut}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return [];
    return nightsInRange(start,end);
  }, [checkIn,checkOut]);
  const estimate = stayNights.length * property.pricePerNight;
  const clientConflict = useMemo(() => stayNights.some(night => unavailable.has(isoDate(night))), [stayNights, unavailable]);
  const [datesState, datesAction, datesPending] = useActionState(async (prev: DatesState, formData: FormData) => {
    const result = await checkAvailabilityAction(prev,formData);
    if(result.status === "ok") setStep("identity");
    return result;
  },{status:"idle" as const});
  const [identityState, identityAction, identityPending] = useActionState(async (prev:IdentityState,formData:FormData)=>{
    const result=await requestGuestOtpAction(prev,formData);
    if(result.status==="sent") setStep("code");
    return result;
  },{status:"idle" as const});
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmBookingAction,{status:"idle" as const});
  const steps = [["dates", t("stepDates")], ["identity",t("stepIdentity")],["code",t("stepCode")]] as const;
  const activeStep = steps.findIndex(([key])=>key===step);
  const formatDate = (value:string) => f.dateTime(new Date(`${value}T12:00:00.000Z`),{dateStyle:"medium"});
  const summary = <div aria-live="polite" className="rounded-[.8rem] bg-surface-alt/75 px-3.5 py-3 text-sm"><p className="font-medium">{property.neighborhood} · {property.city}</p>{checkIn && checkOut && stayNights.length ? <><p className="mt-1.5 text-muted">{formatDate(checkIn)} → {formatDate(checkOut)} · {t("guestsCount",{count:Number(guests)||1})}</p><div className="mt-3 flex items-end justify-between gap-2 border-t border-border/80 pt-2"><span className="text-xs text-muted">{t("estimatedNights",{count:stayNights.length})} × {f.number(property.pricePerNight)} FCFA</span><span className="font-semibold tabular-nums">{f.number(estimate)} FCFA</span></div><p className="mt-1 text-xs leading-relaxed text-muted">{t("estimateNotice")}</p></>:<p className="mt-1 text-sm text-muted">{f.number(property.pricePerNight)} FCFA / {t("nightSingular")}</p>}</div>;
  const progress = <ol aria-label={t("stepsLabel")} className="mb-6 grid grid-cols-3 gap-1">{steps.map(([key,label],index)=><li key={key} aria-current={activeStep===index ? "step":undefined} className={`border-t-2 pt-2 text-xs leading-snug ${activeStep===index?"border-verified font-semibold text-verified":index<activeStep?"border-verified/45 text-muted":"border-border text-muted"}`}><span className="mr-1 tabular-nums">{index+1}.</span>{label}</li>)}</ol>;
  const summaryDetails = <div className="booking-fields-wide">{summary}</div>;

  if(step==="dates") return <>{progress}<form action={datesAction} className="booking-form-grid w-full">
    <input type="hidden" name="propertyId" value={propertyId}/>
    <Field id="checkIn" name="checkIn" type="date" label={t("checkInLabel")} min={minDate} required value={checkIn} onChange={e=>setCheckIn(e.target.value)}/>
    <Field id="checkOut" name="checkOut" type="date" label={t("checkOutLabel")} min={checkIn||minDate} required value={checkOut} onChange={e=>setCheckOut(e.target.value)}/>
    <div className="booking-fields-wide"><Field id="guests" name="guests" type="number" min={1} max={maxGuests} label={t("guestsLabel")} required value={guests} onChange={e=>setGuests(e.target.value)}/></div>
    {checkIn&&checkOut&&stayNights.length?summaryDetails:null}
    {clientConflict?<p role="alert" className="booking-fields-wide rounded-[.75rem] bg-red-50 p-3 text-sm text-danger">{t("unavailableRange")}</p>:null}
    {datesState.status==="error"?<p role="alert" className="booking-fields-wide rounded-[.75rem] bg-red-50 p-3 text-sm text-danger">{t(errorKey(datesState.message))}</p>:null}
    <div className="booking-fields-wide"><Button className="w-full sm:w-auto" type="submit" disabled={datesPending||clientConflict}>{datesPending?t("checkingAvailability"):t("nextCta")}<span aria-hidden="true">→</span></Button></div>
  </form></>;
  if(step==="identity") return <>{progress}<form action={identityAction} className="booking-form-grid w-full">
    <input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="checkIn" value={checkIn}/><input type="hidden" name="checkOut" value={checkOut}/><input type="hidden" name="guests" value={guests}/>
    {summaryDetails}
    <Field id="fullName" name="fullName" label={t("fullNameLabel")} autoComplete="name" required value={fullName} onChange={e=>setFullName(e.target.value)}/>
    <Field id="phone" name="phone" label={t("phoneLabel")} placeholder={t("phonePlaceholder")} type="tel" autoComplete="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/>
    <div className="booking-fields-wide"><Field id="email" name="email" label={t("emailLabel")} placeholder={t("emailPlaceholder")} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
    {identityState.status==="error"?<p role="alert" className="booking-fields-wide rounded-[.75rem] bg-red-50 p-3 text-sm text-danger">{t(errorKey(identityState.message))}</p>:null}
    <div className="booking-fields-wide flex flex-wrap gap-2"><Button className="min-w-40 flex-1" type="submit" disabled={identityPending}>{identityPending?t("sendingCode"):t("sendCode")}</Button><Button type="button" variant="secondary" onClick={()=>setStep("dates")}>{t("backToDates")}</Button></div>
  </form></>;
  return <>{progress}<form action={confirmAction} className="booking-form-grid w-full">
    <input type="hidden" name="propertyId" value={propertyId}/><input type="hidden" name="checkIn" value={checkIn}/><input type="hidden" name="checkOut" value={checkOut}/><input type="hidden" name="guests" value={guests}/><input type="hidden" name="phone" value={phone}/><input type="hidden" name="fullName" value={fullName}/><input type="hidden" name="email" value={email}/><input type="hidden" name="locale" value={locale}/>
    {summaryDetails}
    <div className="booking-fields-wide rounded-[.8rem] border border-verified/15 bg-verified-soft/50 p-3.5 text-sm"><p className="font-medium">{t("codeSent",{phone})}</p><p className="mt-1 text-xs leading-relaxed text-muted">{t("phoneBookingNote")}</p></div>
    <div className="booking-fields-wide"><Field id="code" name="code" label={t("codeLabel")} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required/></div>
    {confirmState.status==="error"?<p role="alert" className="booking-fields-wide rounded-[.75rem] bg-red-50 p-3 text-sm text-danger">{t(errorKey(confirmState.message))}</p>:null}
    <div className="booking-fields-wide flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={()=>setStep("identity")}>{t("editDetails")}</Button><Button className="min-w-44 flex-1" type="submit" disabled={confirmPending}>{confirmPending?t("sendingRequest"):t("confirmCta")}</Button></div>
  </form></>;
}
