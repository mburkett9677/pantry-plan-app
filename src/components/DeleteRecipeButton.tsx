"use client";

import { useTransition } from "react";
import { deleteRecipeAction } from "@/app/actions";

export function DeleteRecipeButton({
  recipeId,
  recipeTitle,
}: {
  recipeId: string;
  recipeTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-danger"
      type="button"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(
          `Delete “${recipeTitle}”? This can’t be undone.`,
        );
        if (!ok) return;
        const fd = new FormData();
        fd.set("id", recipeId);
        startTransition(() => {
          void deleteRecipeAction(fd);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
