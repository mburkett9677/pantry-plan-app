import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slotLabel, toDateKey, weekStartFrom } from "@/lib/dates";
import { groceryCategoryLabel } from "@/lib/shopping";
import { deletePlannedMealAction } from "@/app/actions";

export default async function PlannedMealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const meal = await prisma.plannedMeal.findFirst({
    where: { id, householdId: session.householdId },
    include: {
      requestedBy: true,
      recipe: { include: { ingredients: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!meal) notFound();

  let recipe = meal.recipe;
  if (!recipe) {
    recipe = await prisma.recipe.findFirst({
      where: {
        householdId: session.householdId,
        title: { equals: meal.title, mode: "insensitive" },
      },
      include: { ingredients: { orderBy: { sortOrder: "asc" } } },
    });
  }

  const week = toDateKey(weekStartFrom(meal.date));
  const canEdit = session.member.role !== "KID";

  return (
    <div className="stack">
      <Link className="btn btn-ghost" href={`/plan?week=${week}`}>
        ← Week of {format(weekStartFrom(meal.date), "MMM d")}
      </Link>

      <div>
        <p className="eyebrow">
          {format(meal.date, "EEEE, MMM d")} · {slotLabel(meal.slot)}
        </p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          {recipe?.title || meal.title}
        </h1>
        {meal.requestedBy ? (
          <p className="lede" style={{ margin: "0.35rem 0 0" }}>
            Requested by {meal.requestedBy.name}
          </p>
        ) : null}
        {recipe?.servings ? <p className="lede">Serves {recipe.servings}</p> : null}
      </div>

      {meal.notes ? (
        <section className="panel">
          <h2 className="plan-section-title">Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, margin: "0.5rem 0 0" }}>
            {meal.notes}
          </p>
        </section>
      ) : null}

      <section className="panel stack">
        <h2 className="plan-section-title">Ingredients</h2>
        {!recipe || recipe.ingredients.length === 0 ? (
          <p className="lede" style={{ margin: 0 }}>
            No ingredients on this meal yet
            {canEdit ? " — link a recipe from the week plan." : "."}
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
              <span className="chip">{groceryCategoryLabel(ing.category || "other")}</span>
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <h2 className="plan-section-title">Directions</h2>
        {recipe?.instructions ? (
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, margin: 0 }}>
            {recipe.instructions}
          </p>
        ) : (
          <p className="lede" style={{ margin: 0 }}>
            No directions saved for this meal.
          </p>
        )}
        {recipe && canEdit ? (
          <Link className="btn btn-secondary btn-compact" href={`/recipes/${recipe.id}`}>
            Open full recipe
          </Link>
        ) : null}
      </section>

      {canEdit ? (
        <form action={deletePlannedMealAction}>
          <input type="hidden" name="id" value={meal.id} />
          <input type="hidden" name="next" value={`/plan?week=${week}`} />
          <button className="btn btn-danger" type="submit">
            Remove from plan
          </button>
        </form>
      ) : null}
    </div>
  );
}
