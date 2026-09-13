import Link from "next/link";
import { requireAdult } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";

export default async function RecipesPage() {
  const session = await requireAdult();
  const recipes = await prisma.recipe.findMany({
    where: { householdId: session.householdId },
    include: { _count: { select: { ingredients: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Library</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
            Recipes
          </h1>
        </div>
        <Link className="btn btn-primary" href="/recipes/new">
          Paste recipe
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div className="panel">
          <p className="lede" style={{ margin: 0 }}>
            Paste a full recipe or a plain ingredient list. We’ll structure it for shopping.
          </p>
        </div>
      ) : (
        recipes.map((recipe) => (
          <article
            key={recipe.id}
            className="panel row"
            style={{ justifyContent: "space-between" }}
          >
            <div>
              <Link href={`/recipes/${recipe.id}`}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
                  {recipe.title}
                </strong>
              </Link>
              <div className="lede" style={{ margin: 0, fontSize: "0.9rem" }}>
                {recipe._count.ingredients} ingredients
                {recipe.instructions ? " · has instructions" : ""}
              </div>
            </div>
            <DeleteRecipeButton recipeId={recipe.id} recipeTitle={recipe.title} />
          </article>
        ))
      )}
    </div>
  );
}
