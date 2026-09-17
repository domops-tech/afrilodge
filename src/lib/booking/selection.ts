import { z } from "zod";
import { isoDate, startOfUtcDay } from "./nights";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && isoDate(date) === value;
});
export function validStayRange(checkIn: Date, checkOut: Date, now = new Date()) {
  return checkIn >= startOfUtcDay(now) && checkOut > checkIn;
}
export type SearchParams = Record<string, string | string[] | undefined>;
export function selectionQuery(params: SearchParams) {
  const query = new URLSearchParams();
  for (const key of ["quartier", "arrivee", "depart", "voyageurs", "budget", "tri"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  return query.size ? `?${query}` : "";
}
