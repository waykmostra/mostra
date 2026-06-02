-- ============================================================================
-- MOSTRA — Migration 021 : Prospection / Pipeline commercial
-- ============================================================================
-- Objectif : ajouter le "funnel" commercial sur la table `clients` existante,
--            sans toucher à l'enum `status` (cycle de vie client) ni casser le CRM.
--
-- Ajouts sur `clients` :
--   - pipeline_stage    : étape dans le funnel commercial (NULL = hors funnel)
--   - next_follow_up_on : date de prochaine relance (tri de la vue Prospection)
--   - profile_url       : URL profil prospect (LinkedIn / Instagram / X…)
--
-- Funnel ordonné :
--   Prospection (froids) : froid → contacte → a_relancer
--   Pipeline (chauds)    : repondu → call_booke → proposition
--   Terminal             : signe (→ conversion client) | perdu
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase. Idempotent.
-- ============================================================================


-- ── 1. Colonnes ─────────────────────────────────────────────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS pipeline_stage    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_follow_up_on DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_url       TEXT;


-- ── 2. Contrainte CHECK sur pipeline_stage (idempotent) ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_pipeline_stage_check'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_pipeline_stage_check
      CHECK (pipeline_stage IN (
        'froid', 'contacte', 'a_relancer',
        'repondu', 'call_booke', 'proposition',
        'signe', 'perdu'
      ));
  END IF;
END $$;


-- ── 3. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage
  ON clients(pipeline_stage) WHERE pipeline_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_next_follow_up
  ON clients(next_follow_up_on) WHERE next_follow_up_on IS NOT NULL;


-- ── 4. Backfill léger ───────────────────────────────────────────────────────
-- Seed le funnel à partir des prospects existants (sans compte auth) pour que la
-- vue Prospection soit immédiatement utile. Les clients actifs/anciens/perdus
-- restent hors funnel (pipeline_stage NULL).

UPDATE clients SET pipeline_stage = 'froid'
  WHERE pipeline_stage IS NULL AND profile_id IS NULL AND status = 'cold';

UPDATE clients SET pipeline_stage = 'contacte'
  WHERE pipeline_stage IS NULL AND profile_id IS NULL AND status IN ('interest', 'warm');


-- ============================================================================
-- FIN DE LA MIGRATION 021
-- ============================================================================
-- Vérifs :
--   SELECT pipeline_stage, count(*) FROM clients GROUP BY pipeline_stage;
-- ============================================================================
