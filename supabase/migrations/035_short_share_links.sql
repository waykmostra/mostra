-- ============================================================================
-- MOSTRA — Migration 035 : Liens clients courts
-- ============================================================================
-- Les liens de partage étaient de longs tokens aléatoires
-- (encode(gen_random_bytes(16),'hex')). On les remplace par un slug court et
-- lisible basé sur le nom du projet + un petit suffixe unique :
--   ex. « flowride-video-a3f2c1 »  →  /client/flowride-video-a3f2c1
--
-- Choix produit (Tarik) : sécurité légère assumée, priorité à la lisibilité et
-- à la brièveté. Les anciens liens longs cessent de fonctionner (remplacés).
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent
-- au sens où re-lancer régénère des slugs cohérents (le suffixe dérive de l'id).
-- ============================================================================

-- Nouveau défaut : on garde un fallback random pour les cas où le code ne
-- fournit pas de token (le code applique désormais un slug lisible).
ALTER TABLE projects
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(6), 'hex');

-- ── Régénération : slug(nom) + '-' + 6 hex dérivés de l'id (stable, unique) ──
UPDATE projects
SET share_token =
  NULLIF(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '')
  || '-' || substr(md5(id::text), 1, 6);

-- Sécurité : si un nom ne produisait aucun caractère (slug vide → NULL||... = NULL),
-- on retombe sur un token court aléatoire.
UPDATE projects
SET share_token = 'projet-' || substr(md5(id::text), 1, 6)
WHERE share_token IS NULL;

-- ============================================================================
-- FIN DE LA MIGRATION 035
-- ============================================================================
-- Vérification :
--   SELECT name, share_token FROM projects ORDER BY updated_at DESC LIMIT 10;
--   → tokens du type « nom-du-projet-xxxxxx »
-- ============================================================================
