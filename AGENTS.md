<!-- BEGIN:nextjs-agent-rules -->
# Pour tout agent IA / Claude Code

## Avant d'écrire du code

1. **Lis [CLAUDE.md](./CLAUDE.md)** pour les conventions et patterns à respecter.
2. **Lis [MOSTRA_ARCHITECTURE.md](./MOSTRA_ARCHITECTURE.md)** pour la vue d'ensemble.
3. **N'invente pas de patterns** : cette app utilise Next.js 14 App Router avec des choix très spécifiques (Server Actions, RLS Supabase, 2 rôles). Ne pas appliquer des patterns d'apps SaaS classiques.

## Règles non-négociables

- ❌ Pas de nouveau rôle (admin/client uniquement)
- ❌ Pas de réintroduction d'un concept d'agence
- ❌ Pas de validation password forte (8 chars, majuscule, chiffre — friction inutile)
- ❌ Pas d'envoi automatique d'email pour les liens set-password (copier-coller manuel)
- ❌ Pas de `getCurrentMember` (n'existe plus)
- ❌ Pas de référence à `agency_id`, `agency_members`, `agencies`, `invitations`

## Architecture en 1 phrase

App privée pour Tarik (admin) et ses clients externes. Stack Next.js 14 + Supabase. 2 rôles via `profiles.is_admin`. Lien client public via `share_token` (lecture seule), interactif via login.

## Outils

- `requireAdmin()` / `requireUser()` / `requireProjectAccess()` depuis `@/lib/auth`
- 3 clients Supabase : `createClient` (server), `createClient` (browser), `createAdminClient` (service role)
- Helper `db()` pour les INSERT/UPDATE typés

<!-- END:nextjs-agent-rules -->
