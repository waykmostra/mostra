-- ============================================================================
-- MOSTRA — Migration 036 : suppression de l'espace Founder + de la prospection
-- ============================================================================
-- 1. Supprime toutes les tables de l'espace Founder (dissous côté app).
-- 2. Supprime les fiches PROSPECTS du CRM : on ne garde que les clients
--    « actifs » et « anciens ».
-- 3. Réduit les statuts clients/sociétés à ('active', 'former').
-- 4. Supprime les colonnes du funnel commercial sur clients.
--
-- ⚠️  DESTRUCTIF ET IRRÉVERSIBLE — fais un backup Supabase avant (Database →
--     Backups). À exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- ============================================================================

BEGIN;

-- ── 1. Tables de l'espace Founder ──────────────────────────────────────────
-- Data (bases personnalisables), Notes, Objectifs, KPIs hebdo, Veille, Workflow.
DROP TABLE IF EXISTS data_entries        CASCADE;
DROP TABLE IF EXISTS data_columns        CASCADE;
DROP TABLE IF EXISTS data_sets           CASCADE;
DROP TABLE IF EXISTS notes               CASCADE;
DROP TABLE IF EXISTS note_groups         CASCADE;
DROP TABLE IF EXISTS objectives          CASCADE;
DROP TABLE IF EXISTS weekly_kpis         CASCADE;
DROP TABLE IF EXISTS competitors         CASCADE;
DROP TABLE IF EXISTS content_ideas       CASCADE;
DROP TABLE IF EXISTS daily_workflow_log  CASCADE;
DROP TABLE IF EXISTS daily_workflow_tasks CASCADE;

-- ── 2. Fiches prospects ────────────────────────────────────────────────────
-- Sécurité : un « prospect » qui porte déjà des projets n'est pas supprimé
-- (projects.client_id est ON DELETE SET NULL → on orphelinerait ses projets).
-- Il est reclassé en « ancien » et reste consultable.
UPDATE clients
SET    status = 'former'
WHERE  status IN ('cold', 'interest', 'warm', 'lost')
AND    EXISTS (SELECT 1 FROM projects p WHERE p.client_id = clients.id);

-- Les autres prospects sont supprimés (leurs interactions partent en cascade).
DELETE FROM clients
WHERE  status IN ('cold', 'interest', 'warm', 'lost');

-- Filet : plus aucun statut hors des deux valeurs conservées.
UPDATE clients   SET status = 'active' WHERE status NOT IN ('active', 'former');
UPDATE companies SET status = 'active' WHERE status NOT IN ('active', 'former');

-- ── 3. Statuts réduits à actif / ancien ────────────────────────────────────
ALTER TABLE clients   DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients   ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE clients   ADD  CONSTRAINT clients_status_check
                      CHECK (status IN ('active', 'former'));

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE companies ADD  CONSTRAINT companies_status_check
                      CHECK (status IN ('active', 'former'));

-- ── 4. Colonnes du funnel commercial ───────────────────────────────────────
DROP INDEX IF EXISTS idx_clients_pipeline_stage;
DROP INDEX IF EXISTS idx_clients_next_follow_up_on;
ALTER TABLE clients DROP COLUMN IF EXISTS pipeline_stage;
ALTER TABLE clients DROP COLUMN IF EXISTS next_follow_up_on;

COMMIT;

-- ============================================================================
-- FIN DE LA MIGRATION 036
-- ============================================================================
