# MOSTRA

App privée de gestion de production vidéo pour l'agence Mostra. Permet de suivre les projets clients à travers un pipeline de phases (Analyse → Design → Audio → Animation → Rendu), avec un espace admin pour Tarik et un espace client pour les clients externes.

> **App privée — pas de SaaS public.** Architecture simplifiée : 2 rôles (admin/client), pas de multi-agence.

## Stack

| Couche | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| BD / Auth / Storage / Realtime | Supabase |
| UI | Tailwind v4 + shadcn/ui + Base UI + Lucide |
| Forms | React Hook Form + Zod |
| State serveur | TanStack Query v5 |
| Notifications toast | Sonner |
| Langage | TypeScript 5 (strict) |

## Setup local

```bash
git clone https://github.com/waykmostra/mostra.git
cd mostra
npm install
```

Crée `.env.local` à la racine :
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=MOSTRA
```

Récupère les 3 valeurs Supabase sur https://supabase.com/dashboard/project/_/settings/api.

Applique les migrations SQL dans `supabase/migrations/` via le SQL Editor Supabase (dans l'ordre numérique).

```bash
npm run dev          # localhost:3000
npm run build        # build prod
npm run start        # serveur prod (après build)
npm run lint         # ESLint
```

## Architecture

```
src/
├── app/
│   ├── (auth)/login/         # Login (pas de register public)
│   ├── setup-password/[token]# Création de mdp via lien admin
│   ├── dashboard/            # Dashboard admin
│   ├── projects/             # Gestion projets (admin)
│   ├── clients/              # Gestion clients (admin)
│   ├── settings/             # Pipeline, forms (admin)
│   ├── account/              # Mon compte (tout user)
│   ├── notifications/        # Notifs
│   └── client/               # Espace client
│       ├── [token]/          # Lecture publique via share_token (anonyme)
│       └── dashboard/        # Dashboard client authentifié
├── components/
│   ├── dashboard/            # Sidebar, header, stats, project cards
│   ├── project/              # Phase cards, éditeurs, file viewer
│   ├── client/               # Vues client
│   └── shared/               # Logo, badges, empty states
├── lib/
│   ├── auth.ts               # requireAdmin / requireUser / requireProjectAccess
│   ├── supabase/             # Clients server / browser / admin
│   ├── hooks/                # Realtime hooks
│   ├── notifications.ts      # Système notifs
│   ├── email/                # Templates email (Resend)
│   ├── types/                # Types DB
│   └── utils/                # Dates, files, classes
├── middleware.ts             # Route protection (2 rôles)
└── styles/                   # globals.css
```

## Rôles

| Rôle | Accès | Champ DB |
|---|---|---|
| Admin | Tout (`/dashboard`, `/projects`, `/clients`, `/settings`) | `profiles.is_admin = true` |
| Client | `/client/dashboard` + lecture/actions sur ses projets | `profiles.is_admin = false` |
| Anonyme avec lien | Lecture seule du projet via `/client/[share_token]` | (pas de compte) |

## Flow de création de compte client

1. Admin va sur `/clients/new` → saisit nom + email
2. L'app crée le compte Supabase auth + le profil + génère un `password_setup_tokens.token`
3. Admin **copie le lien** `${APP_URL}/setup-password/{token}` affiché dans la UI
4. Admin transmet le lien au client (WhatsApp, email perso, etc. — pas d'envoi automatique)
5. Client clique le lien → définit son mdp (pas de validation forte) → redirige vers `/login`
6. Client se connecte → voit ses projets sur `/client/dashboard`

## Flow de partage projet client

1. À la création d'un projet, un `share_token` aléatoire est généré
2. Le lien `${APP_URL}/client/{share_token}` est **public** : n'importe qui avec le lien peut consulter en lecture seule (sans login)
3. Pour commenter/approuver, le client doit être authentifié ET être le `client_id` du projet
4. L'admin peut **régénérer** le `share_token` à tout moment depuis la page projet → invalide l'ancien lien

## Migrations Supabase

`supabase/migrations/` contient l'historique SQL. La dernière (`017_radical_simplification.sql`) est la refonte 2 rôles. Pour un nouveau setup, applique-les dans l'ordre numérique via le SQL Editor.

## Déploiement (Vercel)

- Branche `master` → auto-deploy
- Variables d'env à configurer dans Vercel : mêmes que `.env.local` mais avec `NEXT_PUBLIC_APP_URL=https://app.mostra.agency`

## Docs pour Claude

- `CLAUDE.md` : conventions et points clés pour les sessions Claude Code
- `AGENTS.md` : warnings agent (Next.js version)
- `CONTRIBUTING.md` : workflow git et conventions de code
