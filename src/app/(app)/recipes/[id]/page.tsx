import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRecipeInstructionsAction } from "@/app/actions";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";
import { StatusBanner } from "@/components/StatusBanner";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireAdult();
  const { id } = await params;
  const sp = await searchParams;
  const recipe = await prisma.recipe.findFirst({
    where: { id, householdId: session.householdId },
    include: { ingredients: { orderBy: { sortOrder: "asc" } } },
  });
  if (!recipe) notFound();

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link className="btn btn-ghost" href="/recipes">
          ← Recipes
        </Link>
        <DeleteRecipeButton recipeId={recipe.id} recipeTitle={recipe.title} />
      </div>

      {sp.saved ? <StatusBanner tone="ok">Instructions saved.</StatusBanner> : null}

      <div>
        <p className="eyebrow">Recipe</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.9rem" }}>
          {recipe.title}
        </h1>
        {recipe.servings ? <p className="lede">Serves {recipe.servings}</p> : null}
      </div>

      <section className="panel stack">
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
          Ingredients
        </h2>
        {recipe.ingredients.length === 0 ? (
          <p className="lede" style={{ margin: 0 }}>
            No ingredients yet.
          </p>
        ) : (
          recipe.ingredients.map((ing) => (
            <div key={ing.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>
                  {[ing.quantity, ing.unit].filter(Boolean).join(" ")} {ing.name}
                </strong>
                {ing.notes ? (
                  <div className="lede" style={{ margin: 0, fontSize: "0.85rem" }}>
                    {ing.notes}
                  </div>
                ) : null}
              </div>
              <span className="chip">{ing.category || "other"}</span>
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
          Instructions
        </h2>
        {recipe.instructions ? (
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, margin: 0 }}>
            {recipe.instructions}
          </p>
        ) : (
          <p className="lede" style={{ margin: 0 }}>
            No instructions yet — add them below.
          </p>
        )}
        <form action={updateRecipeInstructionsAction} className="stack">
          <input type="hidden" name="id" value={recipe.id} />
          <div className="field">
            <label htmlFor="instructions">Edit directions</label>
            <textarea
              id="instructions"
              name="instructions"
              defaultValue={recipe.instructions || ""}
              placeholder={"1. Preheat oven…\n2. Mix ingredients…\n3. Bake until golden…"}
              style={{ minHeight: 160 }}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Save instructions
          </button>
        </form>
      </section>
    </div>
  );
}
