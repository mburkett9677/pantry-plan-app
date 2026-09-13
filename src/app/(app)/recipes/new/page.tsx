import { requireAdult } from "@/lib/auth";
import { saveRecipeAction } from "@/app/actions";

export default async function NewRecipePage() {
  await requireAdult();

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Import</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>
          Paste a recipe
        </h1>
        <p className="lede">
          Drop in a full recipe, a website dump, or just a grocery list. Use the instructions
          box for cooking steps (or leave it blank if they’re already in the paste).
        </p>
      </div>

      <form action={saveRecipeAction} className="panel stack">
        <div className="field">
          <label htmlFor="title">Title override (optional)</label>
          <input id="title" name="title" placeholder="Leave blank to auto-detect" />
        </div>
        <div className="field">
          <label htmlFor="sourceText">Recipe or ingredients</label>
          <textarea
            id="sourceText"
            name="sourceText"
            required
            placeholder={`Tacos\n1 lb ground beef\n8 tortillas\n1 cup shredded cheese\n...`}
          />
        </div>
        <div className="field">
          <label htmlFor="instructions">Instructions / directions</label>
          <textarea
            id="instructions"
            name="instructions"
            placeholder={"1. Brown the beef\n2. Warm tortillas\n3. Assemble and serve"}
            style={{ minHeight: 140 }}
          />
        </div>
        <button className="btn btn-primary" type="submit">
          Save recipe
        </button>
      </form>
    </div>
  );
}
