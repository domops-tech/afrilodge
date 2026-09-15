import { startOfUtcDay } from "./nights";
export function hasArrivalDateStarted(checkIn: Date, now = new Date()) {
  return checkIn <= startOfUtcDay(now);
}
