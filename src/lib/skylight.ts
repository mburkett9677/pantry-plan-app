/**
 * Skylight Calendar sync via the unofficial private app API.
 * Requires household Skylight credentials (email/password + frame id).
 * This is personal-use only against your own account — Skylight has no public API.
 */

type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
};

const APP_BASE = "https://app.ourskylight.com";

async function login(email: string, password: string): Promise<TokenBundle> {
  // OAuth-style password grant used by community clients; may change over time.
  const res = await fetch(`${APP_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: email,
      password,
      client_id: "skylight-web",
    }),
  });

  if (!res.ok) {
    // Fallback path observed by community tools
    const alt = await fetch(`${APP_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!alt.ok) {
      const text = await alt.text();
      throw new Error(`Skylight login failed (${alt.status}): ${text.slice(0, 200)}`);
    }
    const data = (await alt.json()) as {
      access_token?: string;
      token?: string;
      refresh_token?: string;
    };
    const accessToken = data.access_token || data.token;
    if (!accessToken) throw new Error("Skylight login returned no access token");
    return { accessToken, refreshToken: data.refresh_token };
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function api(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${APP_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export type SkylightMealPayload = {
  date: string; // YYYY-MM-DD
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  title: string;
  recipe?: {
    title: string;
    ingredients?: Array<{ name: string; quantity?: string | null; unit?: string | null }>;
    instructions?: string | null;
  };
};

export async function syncMealsToSkylight(opts: {
  email: string;
  password: string;
  frameId: string;
  meals: SkylightMealPayload[];
}): Promise<{ ok: boolean; synced: number; warnings: string[] }> {
  const warnings: string[] = [];
  const tokens = await login(opts.email, opts.password);
  let synced = 0;

  for (const meal of opts.meals) {
    try {
      let recipeId: string | undefined;
      if (meal.recipe) {
        const createRecipe = await api(tokens.accessToken, `/api/frames/${opts.frameId}/recipes`, {
          method: "POST",
          body: JSON.stringify({
            name: meal.recipe.title,
            ingredients: (meal.recipe.ingredients || []).map((i) => ({
              name: i.name,
              quantity: [i.quantity, i.unit].filter(Boolean).join(" ") || undefined,
            })),
            directions: meal.recipe.instructions || undefined,
          }),
        });
        if (createRecipe.ok) {
          const body = (await createRecipe.json()) as { id?: string; data?: { id?: string } };
          recipeId = body.id || body.data?.id;
        } else {
          warnings.push(`Recipe create failed for ${meal.title}: ${createRecipe.status}`);
        }
      }

      const sittingRes = await api(
        tokens.accessToken,
        `/api/frames/${opts.frameId}/meal_sittings`,
        {
          method: "POST",
          body: JSON.stringify({
            date: meal.date,
            category: meal.slot,
            name: meal.title,
            recipe_id: recipeId,
          }),
        },
      );

      if (!sittingRes.ok) {
        // Alternate endpoint naming used by some client revisions
        const alt = await api(tokens.accessToken, `/api/frames/${opts.frameId}/meals`, {
          method: "POST",
          body: JSON.stringify({
            date: meal.date,
            meal_type: meal.slot,
            title: meal.title,
            recipe_id: recipeId,
          }),
        });
        if (!alt.ok) {
          warnings.push(`Meal sync failed for ${meal.date} ${meal.title}: ${sittingRes.status}`);
          continue;
        }
      }
      synced += 1;
    } catch (err) {
      warnings.push(
        `Meal sync error for ${meal.title}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  return { ok: warnings.length === 0, synced, warnings };
}

export async function testSkylightConnection(opts: {
  email: string;
  password: string;
  frameId: string;
}) {
  const tokens = await login(opts.email, opts.password);
  const res = await api(tokens.accessToken, `/api/frames/${opts.frameId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Frame lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return true;
}
