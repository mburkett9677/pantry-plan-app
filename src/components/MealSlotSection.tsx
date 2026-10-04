"use client";

import Link from "next/link";
import { useState } from "react";
import { AddMealForm } from "@/components/AddMealForm";

type RecipeOption = { id: string; title: string };

type MealItem = {
  id: string;
  title: string;
  recipeTitle?: string | null;
  hasRecipe: boolean;
  requestedByName?: string | null;
};

export function MealSlotSection({
  date,
  slot,
  slotLabel,
  meals,
  recipes,
  canEdit,
  upsertAction,
  deleteAction,
}: {
  date: string;
  slot: string;
  slotLabel: string;
  meals: MealItem[];
  recipes: RecipeOption[];
  canEdit: boolean;
  upsertAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  // Form starts closed; empty slots stay as a single tap target until opened.
  const [open, setOpen] = useState(false);
  const empty = meals.length === 0;

  return (
    <div className={`slot ${empty && !open ? "slot-collapsed" : ""}`}>
      {empty && canEdit ? (
        <button
          type="button"
          className="slot-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <strong>{slotLabel}</strong>
          <span className="slot-toggle-hint">{open ? "Close" : "Add"}</span>
        </button>
      ) : (
        <div className="slot-heading">
          <strong>{slotLabel}</strong>
          {canEdit && !empty ? (
            <button
              type="button"
              className="slot-toggle-hint btn-ghost"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Add"}
            </button>
          ) : null}
        </div>
      )}

      {meals.map((meal) => (
        <div key={meal.id} className="meal-row">
          <Link href={`/plan/meals/${meal.id}`} className="meal-row-text meal-link">
            <div className="meal-title">{meal.recipeTitle || meal.title}</div>
            {meal.hasRecipe ? <div className="meal-meta">Tap for ingredients &amp; directions</div> : null}
            {!meal.hasRecipe ? <div className="meal-meta">Tap to open</div> : null}
            {meal.requestedByName ? (
              <div className="meal-meta">via {meal.requestedByName}</div>
            ) : null}
          </Link>
          {canEdit ? (
            <form action={deleteAction}>
              <input type="hidden" name="id" value={meal.id} />
              <button className="btn btn-ghost btn-compact" type="submit">
                Remove
              </button>
            </form>
          ) : null}
        </div>
      ))}

      {canEdit && open ? (
        <AddMealForm
          action={upsertAction}
          date={date}
          slot={slot}
          slotLabel={slotLabel}
          recipes={recipes}
        />
      ) : null}
    </div>
  );
}
