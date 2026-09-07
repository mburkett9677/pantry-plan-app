import {
  startOfWeek,
  addDays,
  format,
  parseISO,
} from "date-fns";

export const SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export function weekStartFrom(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string) {
  return parseISO(key);
}

export function slotLabel(slot: string) {
  return slot.charAt(0) + slot.slice(1).toLowerCase();
}

export const MEMBER_COLORS = [
  "#2a6f5e",
  "#c45c26",
  "#3b5bdb",
  "#9b2c6d",
  "#2f6f9f",
  "#6b4f2c",
];
