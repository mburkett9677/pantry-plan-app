import OpenAI from "openai";
import { z } from "zod";

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

const parsedRecipeSchema = z.object({
  title: z.string(),
  servings: z.number().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema),
});

export type ParsedRecipe = z.infer<typeof parsedRecipeSchema>;

const CATEGORY_HINT =
  "Use grocery categories like produce, dairy, meat, seafood, bakery, frozen, pantry, spices, beverages, snacks, household, other.";

function heuristicParse(text: string): ParsedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines[0]?.replace(/^#+\s*/, "").slice(0, 120) || "Untitled recipe";
  const ingredients: ParsedRecipe["ingredients"] = [];
  for (const line of lines.slice(1)) {
    if (/^(ingredients?|directions?|instructions?|method|steps?):?$/i.test(line)) continue;
    if (/^\d+\./.test(line) && line.length > 40) continue;
    const match = line.match(
      /^(?:[-*•]\s*)?(?:(\d[\d.\/\s-]*)\s*([a-zA-Z]+)?\s+)?(.+)$/,
    );
    if (!match) continue;
    const [, quantity, unit, name] = match;
    if (!name || name.length < 2) continue;
    ingredients.push({
      name: name.replace(/\s+/g, " ").trim(),
      quantity: quantity?.trim() || null,
      unit: unit?.trim() || null,
      notes: null,
      category: guessCategory(name),
    });
  }
  return {
    title,
    servings: null,
    instructions: null,
    ingredients: ingredients.length
      ? ingredients
      : lines.slice(1).map((name) => ({
          name,
          quantity: null,
          unit: null,
          notes: null,
          category: guessCategory(name),
        })),
  };
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/(milk|cheese|yogurt|butter|cream|egg)/.test(n)) return "dairy";
  if (/(chicken|beef|pork|turkey|bacon|sausage)/.test(n)) return "meat";
  if (/(salmon|shrimp|tuna|fish|cod)/.test(n)) return "seafood";
  if (/(lettuce|tomato|onion|garlic|apple|banana|berry|spinach|carrot|potato|pepper|avocado|lemon|lime|cilantro|basil)/.test(n))
    return "produce";
  if (/(bread|tortilla|bagel|bun)/.test(n)) return "bakery";
  if (/(frozen|ice cream)/.test(n)) return "frozen";
  if (/(salt|pepper|cumin|paprika|oregano|cinnamon|spice)/.test(n)) return "spices";
  if (/(oil|flour|sugar|rice|pasta|bean|broth|sauce|vinegar|soy)/.test(n)) return "pantry";
  if (/(juice|soda|water|coffee|tea)/.test(n)) return "beverages";
  return "other";
}

export async function parseRecipeText(text: string): Promise<ParsedRecipe> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { title: "Untitled recipe", servings: null, instructions: null, ingredients: [] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicParse(trimmed);
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract structured grocery recipes from pasted text or ingredient lists. Return JSON with keys: title, servings (number or null), instructions (string or null), ingredients (array of {name, quantity, unit, notes, category}). ${CATEGORY_HINT} Normalize ingredient names for shopping. If the paste is only a list of ingredients, invent a short title.`,
        },
        { role: "user", content: trimmed.slice(0, 12000) },
      ],
    });
    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = parsedRecipeSchema.parse(JSON.parse(raw));
    return {
      ...parsed,
      ingredients: parsed.ingredients.map((ing) => ({
        ...ing,
        category: ing.category || guessCategory(ing.name),
      })),
    };
  } catch {
    return heuristicParse(trimmed);
  }
}

export { guessCategory };
