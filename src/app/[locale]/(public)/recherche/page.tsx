import { dateOnlySchema, validStayRange } from "@/lib/booking/selection";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { PropertyCard } from "@/components/property/PropertyCard";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerificationNote } from "@/components/property/VerificationNote";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Prisma } from "@/generated/prisma/client";

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/recherche">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const tf = await getTranslations("verification");
  const format = await getFormatter();
  const area = typeof sp.quartier === "string" ? sp.quartier.trim() : "";
  const checkIn = typeof sp.arrivee === "string" ? sp.arrivee : "";
  const checkOut = typeof sp.depart === "string" ? sp.depart : "";
  const guests = typeof sp.voyageurs === "string" && sp.voyageurs ? Number(sp.voyageurs) : undefined;
  const maxPrice = typeof sp.budget === "string" && sp.budget ? Number(sp.budget) : undefined;
  const sort = sp.tri === "prix-croissant" || sp.tri === "prix-decroissant" ? sp.tri : "recent";
  const invalidDates = (Boolean(checkIn) || Boolean(checkOut)) && (!dateOnlySchema.safeParse(checkIn).success || !dateOnlySchema.safeParse(checkOut).success || !validStayRange(new Date(checkIn), new Date(checkOut)));
  const invalidFilters = invalidDates || (guests !== undefined && (!Number.isSafeInteger(guests) || guests < 1)) || (maxPrice !== undefined && (!Number.isSafeInteger(maxPrice) || maxPrice < 0));
  const where: Prisma.PropertyWhereInput = {
    status: "PUBLISHED",
    verification: { is: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
    ...(area ? { OR: [{ neighborhood: { contains: area, mode: "insensitive" } }, { city: { contains: area, mode: "insensitive" } }] } : {}),
    ...(guests !== undefined && Number.isFinite(guests) ? { maxGuests: { gte: guests } } : {}),
    ...(maxPrice !== undefined && Number.isFinite(maxPrice) ? { pricePerNight: { lte: maxPrice } } : {}),
  };
  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  if (checkInDate && checkOutDate && checkOutDate > checkInDate) where.availability = { none: { date: { gte: checkInDate, lt: checkOutDate }, status: { not: "OPEN" } } };
  const orderBy: Prisma.PropertyOrderByWithRelationInput[] = sort === "prix-croissant" ? [{ pricePerNight: "asc" }, { createdAt: "desc" }] : sort === "prix-decroissant" ? [{ pricePerNight: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }];
  const [properties, resultCount, example] = invalidFilters ? [[], 0, null] as const : await Promise.all([
    prisma.property.findMany({ where, select: { id: true, isDemo: true, title: true, neighborhood: true, city: true, pricePerNight: true, maxGuests: true, verification: { select: { visitDate: true, expiresAt: true, status: true } } }, orderBy, take: 30 }),
    prisma.property.count({ where }),
    prisma.property.findFirst({ where: { status: "PUBLISHED", verification: { is: { status: "ACTIVE", expiresAt: { gt: new Date() } } } }, orderBy: { createdAt: "desc" }, select: { verification: { select: { status: true, visitDate: true, expiresAt: true } } } }),
  ]);
  const coverPhotos = properties.length ? await prisma.visitPhoto.findMany({ where: { slot: "FACADE", visit: { verification: { propertyId: { in: properties.map(p => p.id) } } } }, select: { storageKey: true, isDemoPlaceholder: true, visit: { select: { verification: { select: { propertyId: true } } } } } }) : [];
  const coverById = new Map(coverPhotos.map(photo => [photo.visit.verification?.propertyId, photo]));
  const resetUrl = "/recherche";
  const filterCount = [area, checkIn, checkOut, guests, maxPrice].filter(Boolean).length;

  return <div className="flex min-h-screen flex-col"><SiteHeader active="search"/><div className="flex-1">
    <section className="border-b border-border bg-[#f1f0e8]"><div className="page-shell py-9 sm:py-12 lg:py-14"><p className="eyebrow">{t("verifiedFilterHint")}</p><div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><h1 className="text-[clamp(2.3rem,4.5vw,4.4rem)] leading-tight">{area ? <>{t("searchPrefix")} <span className="text-verified">{area}</span></> : t("title")}</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">{t("intro")}</p></div><p className="shrink-0 text-sm text-muted">{t("resultsCount", { count: resultCount })}{resultCount > properties.length ? " · 30" : ""}</p></div>
      <form className="filter-grid surface-card-plain mt-7 p-4 sm:p-5" action={`/${locale}/recherche`}><input type="hidden" name="tri" value={sort}/><div className="filter-location"><Field id="quartier" name="quartier" label={t("cityOrAreaLabel")} placeholder={t("neighborhoodPlaceholder")} defaultValue={area} autoComplete="address-level2"/></div><Field id="arrivee" name="arrivee" type="date" label={t("checkInLabel")} defaultValue={checkIn}/><Field id="depart" name="depart" type="date" label={t("checkOutLabel")} defaultValue={checkOut}/><Field id="voyageurs" name="voyageurs" type="number" min={1} label={t("guestsLabel")} defaultValue={Number.isFinite(guests) ? String(guests) : ""}/><Field id="budget" name="budget" type="number" min={0} label={t("maxPriceLabel")} defaultValue={Number.isFinite(maxPrice) ? String(maxPrice) : ""}/><div className="filter-action flex items-center gap-2"><Button type="submit" className="w-full sm:w-auto">{t("submit")}</Button>{filterCount ? <Link href={resetUrl} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted underline decoration-border underline-offset-4 hover:text-foreground">{t("resetFilters")}</Link> : null}</div></form>
      {filterCount ? <p className="mt-3 text-xs text-muted">{t("activeFilters", { count: filterCount })}{area ? ` · ${area}` : ""}</p> : null}</div></section>
    <section className="page-shell py-8 sm:py-10" aria-label={t("resultsHeading")}>
      {invalidFilters ? <div className="rounded-[var(--radius)] border border-danger/25 bg-red-50 p-4 text-sm text-danger" role="alert">{t("invalidFilters")}</div> : null}
      {resultCount > 0 ? <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted">{t("resultsTitle", { count: resultCount })}{resultCount > properties.length ? " · " + t("resultCap", { count: properties.length }) : ""}</p><form action={`/${locale}/recherche`} className="flex items-center gap-2"><input type="hidden" name="quartier" value={area}/><input type="hidden" name="arrivee" value={checkIn}/><input type="hidden" name="depart" value={checkOut}/><input type="hidden" name="voyageurs" value={guests ?? ""}/><input type="hidden" name="budget" value={maxPrice ?? ""}/><label htmlFor="sort-results" className="text-xs font-medium text-muted">{t("sortLabel")}</label><select id="sort-results" name="tri" defaultValue={sort} className="min-h-11 min-w-0 max-w-[12rem] rounded-full border border-border bg-surface px-3 text-sm"><option value="recent">{t("sortRecent")}</option><option value="prix-croissant">{t("sortPriceAsc")}</option><option value="prix-decroissant">{t("sortPriceDesc")}</option></select><Button type="submit" variant="secondary">{t("sortAction")}</Button></form></div> : null}
      {properties.length ? <div className="property-grid property-grid-wide">{properties.map((property,index)=><PropertyCard key={property.id} property={property} photo={coverById.get(property.id) ?? null} params={sp} priority={index<2}/>)}</div> : invalidFilters ? null : <div className="surface-card-plain px-5 py-12 text-center sm:px-10 sm:py-16"><span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-verified-soft text-verified"><svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></span><h2 className="mt-4 text-2xl sm:text-3xl">{t("noResults")}</h2><p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">{t("noResultsDetail")}</p><Link className="mt-5 inline-flex min-h-11 items-center font-semibold text-verified underline underline-offset-4" href="/recherche">{t("resetFilters")}</Link></div>}
      {example?.verification ? <div className="mt-12 grid gap-4 border-t border-border pt-7 md:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)] md:items-center"><p className="max-w-[45ch] text-sm leading-relaxed text-muted">{t("verifiedFilterHint")}{example.verification.visitDate ? ` ${tf("teamVisitDate", { date: format.dateTime(example.verification.visitDate, { dateStyle: "medium" }) })}` : ""}</p><VerificationNote verification={example.verification} compact/></div> : null}
    </section></div><SiteFooter/></div>;
}
