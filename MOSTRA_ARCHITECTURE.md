# MOSTRA — Architecture technique

> **Version** : 2.0 — refonte radicale (2 rôles, mono-agence)
> **Stack** : Next.js 14 + Supabase + Tailwind v4
> **Pour le setup** : voir [README.md](./README.md). Pour les conventions de code : voir [CLAUDE.md](./CLAUDE.md).

---

## 1. Vision produit

Mostra est une **app privée de gestion de production** utilisée par Tarik (admin) pour suivre les projets vidéo de ses clients externes. Pas un SaaS public — pas de notion d'agence ni de plusieurs admins (le schéma supporte plusieurs admins mais l'usage est mono-utilisateur).

Le cœur du produit :
- Pipeline de phases configurable (Analyse → Design → Audio → Animation → Rendu)
- Chaque phase contient des sous-phases avec différents types de contenu (formulaire, script, moodboard, storyboard, audio, design, vidéo)
- Workflow d'approbation client à chaque étape
- Espace client minimaliste pour consulter et approuver

---

## 2. Rôles

| Rôle | Stockage | Périmètre |
|---|---|---|
| `admin` | `profiles.is_admin = true` | Accès complet : projets, clients, settings, suppression |
| `client` | `profiles.is_admin = false` | Voit ses projets, peut commenter et approuver |
| Anonyme | (pas de compte) | Lecture seule d'un projet via le `share_token` du lien |

---

## 3. Modèle de données

### 3.1 Tables principales

```
profiles               # extension auth.users + is_admin
projects               # un projet = un client + un PM admin
project_phases         # phases d'un projet (instance de phase_templates)
sub_phases             # sous-phases d'une phase
phase_blocks           # blocs typés (form, script, moodboard, etc.)
phase_files            # fichiers uploadés par phase, versionnés
form_templates         # templates de questionnaires (globaux)
phase_templates        # définition des phases par défaut (globaux)
comments               # commentaires sur phase / sub-phase / block, supporte timecode vidéo
activity_logs          # audit trail (admin uniquement)
notifications          # notifs in-app + email
password_setup_tokens  # tokens à usage unique pour créer un mdp
```

### 3.2 Diagramme simplifié

```
profiles (id, email, full_name, is_admin)
   │
   ├── projects.client_id (1 client → N projets)
   ├── projects.project_manager_id (1 admin → N projets)
   ├── phase_files.uploaded_by
   ├── comments.user_id
   └── notifications.user_id

projects
   └── project_phases
        ├── sub_phases
        │    └── phase_blocks (form_question, script_section, etc.)
        └── phase_files (Animation/Rendu sans sub-phases)
```

### 3.3 Sécurité (RLS)

Toutes les tables ont RLS activé. Deux helpers SQL :
- `is_admin()` — true si `auth.uid()` correspond à un profil admin
- `is_project_client(project_id)` — true si `auth.uid()` est le client_id du projet

Policies type :
```sql
-- Admin voit tout
USING (is_admin())

-- Client voit ses projets
USING (client_id = auth.uid())

-- Sur les phases/sous-phases/fichiers/commentaires : client voit si is_project_client(project_id)
```

Les Server Actions côté code utilisent en plus `requireAdmin()`/`requireProjectAccess()` pour défense en profondeur.

---

## 4. Structure code Next.js

```
src/
├── app/
│   ├── (auth)/login/                 # Login
│   ├── setup-password/[token]/       # Création de mdp via lien admin
│   ├── dashboard/                    # Dashboard admin
│   ├── projects/
│   │   ├── new/                      # Création de projet
│   │   ├── [id]/                     # Vue projet admin
│   │   │   ├── phases/[phaseId]/
│   │   │   │   ├── view/             # Visualiseur fichier
│   │   │   │   └── sub/[subPhaseId]/ # Vue sous-phase (form, script, etc.)
│   │   │   └── settings/
│   │   └── *-actions.ts              # Server actions par domaine
│   ├── clients/
│   │   ├── [id]/                     # Fiche client
│   │   └── new/                      # Création client
│   ├── settings/
│   │   ├── pipeline/                 # Édition des phase_templates
│   │   └── forms/                    # Édition des form_templates
│   ├── account/                      # Mon compte
│   ├── notifications/                # Liste des notifs
│   ├── client/
│   │   ├── [token]/                  # Vue publique projet (anonyme)
│   │   │   └── phases/[phaseId]/...
│   │   ├── dashboard/                # Dashboard client authentifié
│   │   └── *-actions.ts              # Actions client (approve, comment)
│   └── api/                          # API routes (webhooks uniquement si besoin)
├── components/
│   ├── dashboard/                    # Sidebar, header, stats, project cards
│   ├── project/                      # Phase cards, éditeurs, file viewer
│   ├── client/                       # Vues client (read-only et actions)
│   └── shared/                       # Logo, badges, empty states, skeleton
├── lib/
│   ├── auth.ts                       # requireAdmin / requireUser / requireProjectAccess / getCurrentProfile
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client (avec session)
│   │   ├── admin.ts                  # Service role (bypass RLS)
│   │   ├── middleware.ts             # Helper pour middleware Edge
│   │   ├── queries.ts                # Fonctions de lecture réutilisables
│   │   └── helpers.ts                # db() helper
│   ├── hooks/                        # Realtime hooks (comments, notifications)
│   ├── notifications.ts              # createNotification, getProjectRecipients
│   ├── email/                        # Resend + templates
│   ├── types/
│   │   ├── database.ts               # Types DB (manuel, en sync avec migrations)
│   │   └── index.ts                  # Barrel export
│   └── utils/                        # Dates, files, classes
├── middleware.ts                     # Auth & routing protection
└── styles/globals.css                # Variables CSS + dark mode
```

---

## 5. Design system

### Couleurs (custom properties)
```css
--mostra-bg: #0a0a0a;
--mostra-card-bg: #1a1a1a;
--mostra-card-bg-hover: #222222;
--mostra-border: #2a2a2a;
--mostra-accent: #00D76B;
--mostra-accent-hover: #00C061;
--mostra-text-secondary: #a0a0a0;
--mostra-text-muted: #666666;
--mostra-status-active: #22C55E;
--mostra-status-completed: #22C55E;
--mostra-status-pending: #6B7280;
--mostra-status-in-progress: #3B82F6;
--mostra-status-in-review: #F59E0B;
```

### Polices
- `Inter` (sans-serif principal)
- `Poppins` (titres, h1/h2)
- `JetBrains Mono` (code, tokens)

### Composants UI
- shadcn/ui pour les primitives (Dialog, Dropdown, Tabs, etc.)
- Base UI (Radix-like) pour les patterns avancés
- Lucide React pour les icônes (jamais d'autre lib)
- Sonner pour les toasts

---

## 6. Flows utilisateur

### 6.1 Création de compte client
1. Admin → `/clients/new` → saisit nom + email
2. Backend crée `auth.users` + `profiles` + `password_setup_tokens` (7 jours)
3. UI affiche le lien `{APP_URL}/setup-password/{token}` à copier
4. Admin transmet manuellement (WhatsApp, email perso, etc.)
5. Client clique → définit mdp (pas de validation forte) → redirect login
6. Client se connecte → `/client/dashboard`

### 6.2 Création de projet
1. Admin → `/projects/new` → saisit nom, description, client, PM
2. Backend crée le projet + un `share_token` aléatoire
3. Backend crée les phases depuis `phase_templates` (avec sub-phases)
4. Notification + email envoyés au client (avec le lien public)
5. Admin peut **régénérer** le `share_token` à tout moment depuis la page projet

### 6.3 Workflow phase
1. Admin démarre une phase (statut `pending` → `in_progress`)
2. Admin remplit le contenu (script, moodboard, etc.) + uploads
3. Admin envoie en review (statut → `in_review`)
4. Client est notifié (in-app + email)
5. Client (loggé) approuve ou demande des révisions
6. Si approuvé → phase suivante débloquée
7. Si révisions → retour `in_progress` + commentaire client posté

### 6.4 Vue publique (lien client)
- `/client/{share_token}` accessible sans login
- Affiche projet, phases (avec cadenas pour non-débloquées), fichiers, commentaires
- Bouton "Se connecter" pour passer en mode interactif
- Lien éternel par défaut, régénérable par l'admin

---

## 7. Supabase Storage

```
project-files/                # privé, accès RLS
└── {project_id}/
    └── {phase_slug}/
        └── v{n}/
            └── {filename}

agency-assets/                # public (logo Mostra, etc.)
avatars/{user_id}/avatar.ext  # public
```

Limite : 500 MB par fichier. MIMEs autorisés : PDF, images (PNG/JPG/WEBP/SVG/GIF), vidéos (MP4/MOV/WebM/AVI), audio (MP3/WAV/M4A/OGG/AAC), archives (ZIP), divers (octet-stream).

---

## 8. Realtime

Tables publiées (cf. migration 004) :
- `comments` — pour les threads en temps réel
- `activity_logs` — pour l'historique live
- `project_phases` — pour les changements de statut
- `phase_files` — pour les nouveaux uploads
- `notifications` — pour les push in-app

Hooks dispos dans `src/lib/hooks/` : `useRealtimeComments`, `useRealtimeNotifications`, `useRealtimeBlockComments`.

---

## 9. Notifications

Système 3 canaux :
- **In-app** : `notifications` table + `NotificationBell` component (avec Realtime)
- **Email** : Resend via `lib/email/send.ts` (templates dans `lib/email/templates/`)
- **Toast** : Sonner pour le feedback immédiat des actions

Types : `comment_added`, `phase_approved`, `revision_requested`, `form_submitted`, `phase_ready`, `file_uploaded`, `project_created`.

---

## 10. Variables d'environnement

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public — URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — clé anon (RLS s'applique) |
| `SUPABASE_SERVICE_ROLE_KEY` | Privé — bypass RLS (server-only) |
| `NEXT_PUBLIC_APP_URL` | URL de base (localhost ou prod) — utilisée dans les liens email |
| `NEXT_PUBLIC_APP_NAME` | Affichage UI |
| `RESEND_API_KEY` (optionnel) | Pour les emails |

---

## 11. Migrations DB

`supabase/migrations/` contient l'historique numérique :
- `001-016` : schéma initial multi-agence (legacy)
- `017_radical_simplification.sql` : refonte vers 2 rôles mono-agence

Pour un fresh setup, exécuter dans l'ordre via SQL Editor Supabase.

---

## 12. Pas dans le scope

- ❌ Multi-agence / multi-tenant
- ❌ Codes d'invitation (XXXX-XXXX)
- ❌ Magic links automatiques
- ❌ Validation password forte
- ❌ Super admin / agency_admin / creative (4 rôles supprimés)
- ❌ Application mobile native (web responsive only)
