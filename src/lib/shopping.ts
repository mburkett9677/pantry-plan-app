import type { Aisle, RecipeIngredient } from "@prisma/client";

export type AggregateIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  sources: string[];
};

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function aggregateIngredients(
  items: Array<RecipeIngredient & { recipeTitle: string }>,
): AggregateIngredient[] {
  const map = new Map<string, AggregateIngredient>();
  for (const item of items) {
    const key = normalizeName(item.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category || "other",
        sources: [item.recipeTitle],
      });
      continue;
    }
    if (!existing.sources.includes(item.recipeTitle)) {
      existing.sources.push(item.recipeTitle);
    }
    if (item.quantity && existing.quantity && item.quantity !== existing.quantity) {
      existing.quantity = `${existing.quantity} + ${item.quantity}`;
    } else if (item.quantity && !existing.quantity) {
      existing.quantity = item.quantity;
    }
    if (!existing.unit && item.unit) existing.unit = item.unit;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function matchAisle(category: string, aisles: Aisle[]) {
  const cat = category.toLowerCase().trim();
  const match = aisles.find((a) =>
    a.categories.some((c) => c.toLowerCase().trim() === cat || cat.includes(c.toLowerCase())),
  );
  if (match) return match;
  const fuzzy = aisles.find((a) =>
    a.categories.some(
      (c) =>
        cat.includes(c.toLowerCase()) ||
        c.toLowerCase().includes(cat) ||
        a.name.toLowerCase().includes(cat),
    ),
  );
  return fuzzy || null;
}

export function sortShoppingByAisle<
  T extends { aisleNumber: number | null; name: string; category?: string | null },
>(items: T[]) {
  return [...items].sort((a, b) => {
    const an = a.aisleNumber ?? 9999;
    const bn = b.aisleNumber ?? 9999;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });
}
