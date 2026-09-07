# PantryPlan

Family meal planner web app: paste recipes, plan the week, generate aisle-sorted shopping lists, and sync meals to Skylight Calendar.

## Features

- Shared household with invite code (kids can request lunches from their devices)
- Recipe paste + AI parsing (`OPENAI_API_KEY`) with local fallback parser
- Weekly meal plan (breakfast / lunch / dinner / snack)
- Store aisle maps you set while walking the store
- Shopping lists sorted by aisle
- Skylight Meals sync (unofficial private API; credentials in Settings)

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `OPENAI_API_KEY` | no | Better recipe parsing |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |

## Skylight

Skylight has no official public API. Sync uses the same private app endpoints community tools use. Add email, password, and frame ID under **Settings**. Personal use against your own account only.
