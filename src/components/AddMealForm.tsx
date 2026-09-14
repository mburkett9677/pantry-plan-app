"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type RecipeOption = { id: string; title: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary btn-compact" type="submit" disabled={pending}>
      {pending ? "Adding…" : label}
    </button>
  );
}

export function AddMealForm({
  action,
  date,
  slot,
  slotLabel,
  recipes,
}: {
  action: (formData: FormData) => void | Promise<void>;
  date: string;
  slot: string;
  slotLabel: string;
  recipes: RecipeOption[];
}) {
  const [recipeId, setRecipeId] = useState("");
  const selected = recipes.find((r) => r.id === recipeId);

  return (
    <form action={action} className="add-meal-form">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="slot" value={slot} />
      {selected ? <input type="hidden" name="title" value={selected.title} /> : null}
      <select
        name="recipeId"
        value={recipeId}
        onChange={(e) => setRecipeId(e.target.value)}
        className="add-meal-select"
      >
        <option value="">Choose a recipe…</option>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
      {!selected ? (
        <input
          name="title"
          className="add-meal-input"
          placeholder={`Or type ${slotLabel.toLowerCase()}`}
        />
      ) : null}
      <SubmitButton label="Add" />
    </form>
  );
}
