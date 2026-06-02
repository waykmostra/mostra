# Contribuer à MOSTRA

App privée — voir [README.md](./README.md) pour le contexte et [CLAUDE.md](./CLAUDE.md) pour les conventions détaillées.

## Workflow git

1. Créer une branche depuis `master` : `feat/`, `fix/`, ou `chore/` selon le type
2. Commits atomiques avec un message clair
3. Ouvrir une PR vers `master`

## Avant un commit

```bash
npm run lint        # zéro warning ESLint
npx tsc --noEmit    # zéro erreur TS
npm run build       # le build doit passer
```

Optionnel mais conseillé :
```bash
npx prettier --write "src/**/*.{ts,tsx}"
```

## Conventions de code

### TypeScript
- Strict mode actif
- Pas de `any` sauf via le helper `db()` dans `src/lib/supabase/helpers.ts`
- Typer toutes les props de composants
- Pas de `@ts-ignore`

### Composants
- Server Components par défaut ; `'use client'` uniquement si nécessaire
- Server Actions colocalisées avec la route (`actions.ts`, `*-actions.ts`)
- Composants partagés dans `src/components/shared/`

### Supabase
- `createClient()` (server) dans les Server Components et Actions
- `createClient()` (browser) dans les hooks `'use client'`
- `createAdminClient()` UNIQUEMENT après une vérif d'auth via `requireAdmin()` / `requireUser()` / `requireProjectAccess()`
- Toujours envelopper dans `db()` pour les INSERT/UPDATE complexes

### Auth (rappel critique)
- Toute Server Action commence par un helper de `@/lib/auth`
- Jamais d'auth manuelle (`supabase.auth.getUser()` + check ad hoc)
- Lire `CLAUDE.md` section "Patterns à respecter" avant de créer une nouvelle action

### Migrations
- Toute modif de schéma DB → nouvelle migration numérotée
- Ne jamais modifier une migration déjà appliquée
- Tester en local avant prod

## Build & déploiement

- `master` push → Vercel auto-deploy
- Variables d'env Vercel : voir README
- Toujours vérifier que `NEXT_PUBLIC_APP_URL` pointe vers le bon domaine (prod vs local)
