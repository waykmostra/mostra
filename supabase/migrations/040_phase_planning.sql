-- ============================================================================
-- MOSTRA — Migration 040 : planning des étapes (Gantt en escalier)
-- ============================================================================
-- Dates prévues de chaque grande étape d'un projet. Kylian les pose en
-- glissant les barres du planning (page projet admin) ; le client les voit en
-- lecture seule sur sa vue d'ensemble, avec la date de livraison prévue
-- (= fin prévue de la dernière étape).
--
-- started_at / completed_at existent déjà : le planning affiche le réel en
-- trait fin sous le prévu quand ils diffèrent.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase, une fois, après un
-- backup. Idempotent. Aucune nouvelle policy : project_phases garde ses règles
-- (écriture admin, lecture client via is_project_client).
-- ============================================================================

ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS planned_start DATE,
  ADD COLUMN IF NOT EXISTS planned_end   DATE;

ALTER TABLE project_phases
  DROP CONSTRAINT IF EXISTS project_phases_planned_range;
ALTER TABLE project_phases
  ADD CONSTRAINT project_phases_planned_range
  CHECK (planned_start IS NULL OR planned_end IS NULL OR planned_end >= planned_start);

-- ============================================================================
-- FIN DE LA MIGRATION 040
-- ============================================================================
-- Vérification :
--   SELECT name, planned_start, planned_end FROM project_phases LIMIT 10;
-- ============================================================================
