# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Tarik (admin, utilisateur unique côté agence).** Travaille sur desktop, l'app est son outil de production principal. Il y passe la journée : suivi de l'avancement des projets vidéo, remplissage des livrables par phase (script, moodboard, storyboard, audio, design, vidéo), mise en review, relance des clients.

**Les clients (externes, comptes individuels).** Passent ponctuellement et majoritairement depuis leur téléphone. Job : consulter où en est leur vidéo, ouvrir un livrable, commenter, approuver ou demander des révisions. Ils ne vivent pas dans l'app — ils y entrent via une notification ou un lien envoyé par Tarik, font une chose, et repartent.

**Anonymes.** Peuvent lire un projet en lecture seule via le `share_token` du lien public, sans compte.

Les deux expériences (desktop dense pour Tarik, mobile ponctuel pour les clients) sont à traiter séparément, pas comme un seul responsive.

## Product Purpose

App privée de gestion de production vidéo. Elle remplace les allers-retours WhatsApp/Drive/mail entre Tarik et ses clients par un pipeline unique où chaque phase a un état, un contenu typé et une décision client explicite.

Le succès : Tarik sait en un coup d'œil ce qui l'attend et ce qui attend le client ; le client comprend où en est sa vidéo et peut approuver sans appeler.

## Positioning

Ce n'est pas un outil de gestion de projet générique. Le pipeline est modelé sur le processus réel de production motion design — Analyse → Design → Audio → Animation → Rendu — et chaque sous-phase porte un **type de contenu propre au métier** (formulaire de brief, script sectionné avec timecodes, moodboard, storyboard, review audio, review vidéo avec commentaires timecodés). L'approbation client est un état du pipeline, pas un commentaire dans un fil.

## Operating Context

- Un projet = un client + un PM admin + un `share_token` permanent régénérable.
- Phases instanciées depuis des `phase_templates` globaux, éditables par Tarik dans les settings.
- Chaque phase : `pending` → `in_progress` → `in_review` → approuvée (débloque la suivante) ou renvoyée en révision.
- Fichiers versionnés par phase (`v1`, `v2`…), 500 MB max, dans un bucket privé sous RLS.
- Notifications sur 3 canaux : in-app (Realtime), email (Resend), toast (Sonner).
- Création de compte client : Tarik génère un lien `setup-password`, le transmet **manuellement** (WhatsApp, mail perso). Pas d'envoi automatique.
- Realtime actif sur commentaires, logs d'activité, statuts de phase, fichiers, notifications.

## Capabilities and Constraints

- **Deux rôles seulement** : `admin` (`profiles.is_admin = true`) et `client`. Pas de multi-agence, pas de super_admin / agency_admin / creative, pas de codes d'invitation.
- Toute Server Action passe par `requireAdmin()`, `requireUser()` ou `requireProjectAccess(projectId)`. RLS Supabase en défense de profondeur.
- Stack figée : Next.js 14 App Router, Supabase, Tailwind v4, Server Components par défaut, Server Actions colocalisées, pas d'API routes sauf webhooks.
- Icônes : Lucide uniquement. Toasts : Sonner. Formulaires : React Hook Form + Zod. Dates : date-fns locale `fr`.
- Pas de validation de mot de passe forte (friction jugée inutile pour ce public).
- Web responsive uniquement, pas d'app native.
- Langue d'interface : français.

### État technique à corriger (constaté, non voulu)

L'app porte **trois systèmes de tokens concurrents empilés** : les `--mostra-*` sombres d'origine, les variables oklch de shadcn, et une refonte claire « Compagnon » (`--c-*`) migrée à moitié. Les écrans migrés utilisent `bg-surface`/`text-ink`, les autres gardent des hex sombres en dur. C'est la cause structurelle de l'incohérence visuelle actuelle, pas un problème de goût isolé.

## Brand Commitments

- **Nom et logo Mostra** existants, wordmark SVG fourni.
- **La direction artistique de référence est celle du site mostra_site**, contrainte posée explicitement par l'utilisateur. L'app doit appartenir au même monde de marque que le site de l'agence. Source d'autorité : `mostra_site/src/app/globals.css`.
- Vert de marque `#00d96b`, présent dans les deux produits.
- Voix : française, directe, sans jargon SaaS.

## Evidence on Hand

- `mostra_site/` en local : site marketing de l'agence, DA complète et annotée dans `src/app/globals.css`, plus `AGENTS.md` (partiellement obsolète sur les hex).
- `MOSTRA_ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md` dans ce repo : architecture, rôles, flows, conventions — à jour.
- Base Supabase de production avec projets et clients réels.
- Pas de données de démo fiables : `scripts/seed.ts` est legacy (référence encore le modèle multi-agence supprimé). Ne pas s'en servir comme vérité produit.

## Product Principles

1. **Le pipeline est le produit.** L'état d'avancement et la décision client attendue sont l'information la plus importante de chaque écran ; tout le reste est secondaire.
2. **Deux publics, deux densités.** Tarik veut de la densité et de la scanabilité sur desktop. Le client veut une chose claire à faire sur mobile. Ne jamais servir l'un au détriment de l'autre.
3. **L'espace client est une vitrine.** C'est la seule partie de l'app que voient les clients de l'agence ; sa qualité perçue engage la crédibilité de Mostra.
4. **Un seul système.** Un jeu de tokens, une famille de composants. Toute cohabitation de systèmes concurrents est une régression.
5. **Pas de friction inventée.** L'app supprime des allers-retours ; elle n'en ajoute pas sous prétexte de rigueur.

## Accessibility & Inclusion

Interface française. Cibles tactiles ≥ 44px sur les surfaces client (usage mobile dominant). Contraste de texte à respecter strictement : le vert de marque `#00d96b` ne passe pas en texte sur fond clair (1.81:1) — la variante `#036e36` existe pour cet usage dans le système du site.
