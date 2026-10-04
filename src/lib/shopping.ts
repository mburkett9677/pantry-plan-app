import type { Aisle, RecipeIngredient } from "@prisma/client";

export type AggregateIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string;
  sources: string[];
};

/** Store-section order used on shopping lists. */
export const GROCERY_CATEGORIES = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "frozen",
  "international",
  "pasta/sauce",
  "canned",
  "baking",
  "spices",
  "beverages",
  "snacks",
  "household",
  "pantry",
  "other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: "Produce",
  meat: "Meat",
  seafood: "Seafood",
  dairy: "Dairy",
  bakery: "Bakery",
  frozen: "Frozen",
  international: "International",
  "pasta/sauce": "Pasta & sauce",
  canned: "Canned",
  baking: "Baking",
  spices: "Spices",
  beverages: "Beverages",
  snacks: "Snacks",
  household: "Household",
  pantry: "Pantry",
  other: "Other",
};

const CATEGORY_ALIASES: Record<string, GroceryCategory> = {
  produce: "produce",
  fruit: "produce",
  fruits: "produce",
  vegetable: "produce",
  vegetables: "produce",
  veg: "produce",
  meat: "meat",
  meats: "meat",
  poultry: "meat",
  deli: "meat",
  seafood: "seafood",
  fish: "seafood",
  dairy: "dairy",
  eggs: "dairy",
  bakery: "bakery",
  bread: "bakery",
  frozen: "frozen",
  international: "international",
  ethnic: "international",
  asian: "international",
  mexican: "international",
  "pasta/sauce": "pasta/sauce",
  pasta: "pasta/sauce",
  "pasta sauce": "pasta/sauce",
  pasta_sauce: "pasta/sauce",
  sauce: "pasta/sauce",
  sauces: "pasta/sauce",
  canned: "canned",
  cans: "canned",
  "canned goods": "canned",
  baking: "baking",
  bake: "baking",
  spices: "spices",
  spice: "spices",
  seasonings: "spices",
  beverages: "beverages",
  drinks: "beverages",
  snacks: "snacks",
  snack: "snacks",
  household: "household",
  pantry: "pantry",
  other: "other",
};

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function groceryCategoryLabel(category: string) {
  const key = normalizeGroceryCategory(category);
  return CATEGORY_LABELS[key];
}

export function groceryCategoryOrder(category: string | null | undefined) {
  const key = normalizeGroceryCategory(category);
  const index = GROCERY_CATEGORIES.indexOf(key);
  return index < 0 ? GROCERY_CATEGORIES.length : index;
}

export function normalizeGroceryCategory(raw: string | null | undefined): GroceryCategory {
  const key = (raw || "other").toLowerCase().trim();
  if ((GROCERY_CATEGORIES as readonly string[]).includes(key)) {
    return key as GroceryCategory;
  }
  return CATEGORY_ALIASES[key] || "other";
}

/**
 * Map an ingredient to a grocery-store section. Prefer a specific stored
 * category when it is already one of the known sections.
 */
export function guessGroceryCategory(
  name: string,
  storedCategory?: string | null,
): GroceryCategory {
  const stored = storedCategory ? normalizeGroceryCategory(storedCategory) : "other";
  if (stored !== "other" && stored !== "pantry") return stored;

  const n = name.toLowerCase();

  if (/(chicken|beef|pork|turkey|bacon|sausage|ham|steak|lamb|ground chuck|ground turkey|meatball|hot dog|pepperoni|prosciutto|salami)/.test(n)) {
    return "meat";
  }
  if (/(salmon|shrimp|tuna|cod|tilapia|crab|clam|scallop|anchov|fish fillet|seafood)/.test(n)) {
    return "seafood";
  }
  if (
    /(milk|cheese|yogurt|butter|cream|egg|sour cream|half[- ]and[- ]half|parmesan|mozzarella|cheddar|ricotta|feta|cottage cheese)/.test(
      n,
    )
  ) {
    return "dairy";
  }
  if (/(bread|tortilla|bagel|bun|pita|croissant|roll|baguette|english muffin)/.test(n) && !/chip/.test(n)) {
    return "bakery";
  }
  if (/(frozen|ice cream|popsicle)/.test(n)) return "frozen";
  if (
    /(soy sauce|fish sauce|sesame oil|miso|gochujang|sriracha|hoisin|nori|wonton|ramen|curry paste|coconut milk|taco seasoning|enchilada|salsa|kimchi|rice vinegar|naan|dumpling|teriyaki)/.test(
      n,
    )
  ) {
    return "international";
  }
  if (
    /(spaghetti|linguine|penne|lasagna|fettuccine|noodle|pasta|marinara|alfredo|pesto|pasta sauce|tomato sauce)/.test(
      n,
    )
  ) {
    return "pasta/sauce";
  }
  if (/(canned |can of |diced tomato|crushed tomato|tomato paste|canned bean|chickpea|black bean|kidney bean|canned tuna|canned corn|coconut cream)/.test(n)) {
    return "canned";
  }
  if (
    /(all[- ]purpose flour|flour|granulated sugar|brown sugar|powdered sugar|baking soda|baking powder|yeast|cocoa|vanilla extract|chocolate chip|cornstarch|cake mix)/.test(
      n,
    )
  ) {
    return "baking";
  }
  if (
    /(bell pepper|jalape[ñ]o|poblano|habanero|lettuce|tomato|onion|garlic|apple|banana|berr|spinach|carrot|potato|avocado|lemon|lime|cilantro|basil|cucumber|celery|broccoli|cabbage|kale|zucchini|mushroom|parsley|mint|dill|ginger|shallot|scallion|green onion|herb|orange|mango|grape|peach|pear|melon|watermelon|pineapple|asparagus|cauliflower|squash|corn on|fresh corn|salad mix|arugula)/.test(
      n,
    )
  ) {
    return "produce";
  }
  if (
    /(black pepper|ground pepper|kosher salt|sea salt|cumin|paprika|oregano|cinnamon|chili powder|garlic powder|onion powder|thyme|rosemary|nutmeg|bay leaf|seasoning|spice)/.test(
      n,
    )
  ) {
    return "spices";
  }
  if (/(juice|soda|sparkling water|coffee|tea|wine|beer|kombucha)/.test(n)) return "beverages";
  if (/(chip|cracker|popcorn|cookie|pretzel|granola bar)/.test(n)) return "snacks";
  if (/(paper towel|dish soap|foil|parchment|trash bag|sponge)/.test(n)) return "household";
  if (/(oil|rice|broth|vinegar|oat|peanut butter|ketchup|mustard|mayo|honey|maple|bean|stock)/.test(n)) {
    return "pantry";
  }

  return stored === "pantry" ? "pantry" : "other";
}

export function aggregateIngredients(
  items: Array<RecipeIngredient & { recipeTitle: string }>,
): AggregateIngredient[] {
  const map = new Map<string, AggregateIngredient>();
  for (const item of items) {
    const key = normalizeName(item.name);
    const category = guessGroceryCategory(item.name, item.category);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category,
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
    if (groceryCategoryOrder(category) < groceryCategoryOrder(existing.category)) {
      existing.category = category;
    }
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

export function sortShoppingByCategory<
  T extends { name: string; category?: string | null },
>(items: T[]) {
  return [...items].sort((a, b) => {
    const order = groceryCategoryOrder(a.category) - groceryCategoryOrder(b.category);
    if (order !== 0) return order;
    return a.name.localeCompare(b.name);
  });
}

export function groupShoppingByCategory<T extends { name: string; category?: string | null }>(
  items: T[],
): Array<{ key: GroceryCategory; label: string; items: T[] }> {
  const buckets = new Map<GroceryCategory, T[]>();
  for (const item of items) {
    const key = guessGroceryCategory(item.name, item.category);
    const list = buckets.get(key) || [];
    list.push(item);
    buckets.set(key, list);
  }
  return GROCERY_CATEGORIES.filter((key) => (buckets.get(key) || []).length > 0).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    items: (buckets.get(key) || []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
