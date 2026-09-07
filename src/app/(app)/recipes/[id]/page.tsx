import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdult();
  const { id } = await params;
  const recipe = await prisma.recipe.findFirst({
    where: { id, householdId: session.householdId },
    include: { ingredients: { orderBy: { sortOrder: "asc" } } },
  });
  if (!recipe) notFound();

  return (
    <div className="stack">
      <Link className="btn btn-ghost" href="/recipes">
        ← Recipes
      </Link>
      <div>
        <p className="eyebrow">Recipe</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.9rem" }}>
          {recipe.title}
        </h1>
        {recipe.servings ? (
          <p className="lede">Serves {recipe.servings}</p>
        ) : null}
      </div>

      <section className="panel stack">
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
          Ingredients
        </h2>
        {recipe.ingredients.map((ing) => (
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
        ))}
      </section>

      {recipe.instructions && (
        <section className="panel">
          <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
            Directions
          </h2>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginBottom: 0 }}>
            {recipe.instructions}
          </p>
        </section>
      )}
    </div>
  );
}
