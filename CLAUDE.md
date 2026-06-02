# CLAUDE.md

Doc de référence pour les sessions Claude Code sur l'app MOSTRA. À lire avant tout changement.

@AGENTS.md

---

## TL;DR de l'app

App privée Next.js 14 + Supabase pour Tarik (agence Mostra). 2 rôles uniquement : `admin` (Tarik) et `client` (externes). Pas de multi-agence, pas de codes d'invitation, pas de validation password forte. Voir [README.md](./README.md) pour le setup.

## Règles d'or

### 🔐 Sécurité

- **Toute Server Action** doit commencer par `requireAdmin()`, `requireUser()`, ou `requireProjectAccess(projectId)` depuis `@/lib/auth`. Jamais d'auth manuelle.
- **Jamais utiliser `createAdminClient()` (bypass RLS)** sans avoir vérifié l'auth en amont via les helpers ci-dessus.
- **Toujours vérifier l'ownership** : un user accédant à une ressource doit en être propriétaire (admin = oui pour tout, client = uniquement `client_id = user.id`).

### 🏗️ Architecture

- **Server Components par défaut.** `'use client'` uniquement si nécessaire (event handlers, hooks browser, state local).
- **Server Actions colocalisées** : `actions.ts`, `*-actions.ts` à côté des routes. Jamais dans `src/lib/`.
- **Pas d'API routes** sauf nécessité (webhooks). Privilégier Server Actions.
- **Types DB centralisés** dans `src/lib/types/database.ts`. Les composants importent depuis `@/lib/types`.

### 🎨 UI

- **Design system dans `src/styles/globals.css`** (custom properties CSS) + `src/app/globals.css` (Tailwind v4 theme inline).
- **Couleurs Mostra** : `#00D76B` (accent vert), `#0a0a0a` (bg), `#1a1a1a` / `#1e1e1e` (cards), `#2a2a2a` (borders), `#666666` (text secondary).
- **Dark mode par défaut**, pas de toggle (app privée).
- **Composants partagés** : `src/components/shared/` (Logo, StatusBadge, EmptyState, etc.).
- **Lucide pour les icônes**, pas d'autre lib.

### 💾 Supabase

3 clients différents — savoir lequel utiliser :

```ts
// Server Component / Server Action (avec session user)
import { createClient } from '@/lib/supabase/server'
const supabase = createClient()

// Client Component (hooks, browser)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server uniquement, bypass RLS (créer user, etc.)
import { createAdminClient } from '@/lib/supabase/admin'
const admin = createAdminClient()
```

Pour les types INSERT/UPDATE complexes, utiliser le helper `db()`:
```ts
import { db } from '@/lib/supabase/helpers'
await db(supabase).from('projects').insert({ ... })
```

### 🧭 Routing

| Route | Qui y accède |
|---|---|
| `/login` | Public |
| `/setup-password/[token]` | Public (avec token valide) |
| `/dashboard`, `/projects/*`, `/clients/*`, `/settings/*`, `/account`, `/notifications` | Admin uniquement |
| `/client/dashboard` | Client authentifié |
| `/client/[token]` | Public (lecture seule) — devient interactif si l'user est loggé ET est le `client_id` |

`middleware.ts` gère la protection. Modifier avec prudence.

## Patterns à respecter

### Pattern Server Action admin
```ts
'use server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/supabase/helpers'

export async function maFonction(input: ...): Promise<Result> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  // ... logique
  
  revalidatePath('/dashboard')
  return { success: true }
}
```

### Pattern Server Action client (sur un projet)
```ts
'use server'
import { requireProjectAccess } from '@/lib/auth'

export async function maAction(projectId: string, ...): Promise<Result> {
  const auth = await requireProjectAccess(projectId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user, canEdit } = auth
  // canEdit = true si admin, false si client (mais accès ok)
  
  // ... logique
}
```

### Pattern lecture publique via share_token
```ts
// Mode lecture seule pour le lien client public
async function resolveByToken(token: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projects')
    .select('id, client_id, share_token')
    .eq('share_token', token)
    .maybeSingle()
  return data
}
```

## Conventions de code

- **TypeScript strict.** Pas de `any` sauf via `db()` helper.
- **Imports** : alias `@/` pour `src/`.
- **Fichiers** : 1 composant = 1 fichier. PascalCase pour composants, camelCase pour utils, kebab-case pour les pages dynamiques.
- **Dates** : `date-fns` avec `locale: fr`.
- **Forms** : React Hook Form + Zod.
- **State serveur côté client** : TanStack Query (déjà installé).

## Choses à NE PAS faire

- ❌ Ajouter un rôle (admin/client uniquement)
- ❌ Réintroduire le concept d'agence
- ❌ Ajouter une validation password forte (friction inutile)
- ❌ Envoyer des emails automatiques pour les set-password (copier-coller manuel)
- ❌ Utiliser `getCurrentMember` (n'existe plus — utiliser `requireAdmin`/`getCurrentProfile`)
- ❌ Référencer `agency_id`, `agency_members`, `agencies`, `invitations` (tables supprimées)
- ❌ Comparer `userRole === 'super_admin'` ou `'agency_admin'` ou `'creative'` (n'existent plus)

## Avant un commit

```bash
npm run lint        # ESLint zéro warning
npx tsc --noEmit    # zéro erreur TS
npm run build       # build doit passer
```

## Migrations DB

- Toute modif de schéma → nouvelle migration `supabase/migrations/0XX_<nom>.sql`
- Ne **jamais** modifier une migration déjà appliquée
- Tester en local avant d'exécuter sur Supabase prod
