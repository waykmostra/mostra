-- ============================================================================
-- MOSTRA — Migration 034 : Statut CRM sur les sociétés
-- ============================================================================
-- Le CRM passe d'un Kanban de CLIENTS (par statut) à un Kanban de SOCIÉTÉS
-- (par statut). Les sociétés portent désormais un statut de pipeline comme les
-- clients (froid / intérêt / chaud / actif / ancien / perdu). Les fiches client
-- deviennent des contacts rattachés à leur société.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'interest'
    CHECK (status IN ('cold', 'interest', 'warm', 'active', 'former', 'lost'));

CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ── Backfill : statut de la société = statut le plus avancé parmi ses clients ──
WITH ranked AS (
  SELECT
    c.company_id,
    MAX(
      CASE c.status
        WHEN 'active'   THEN 5
        WHEN 'warm'     THEN 4
        WHEN 'interest' THEN 3
        WHEN 'cold'     THEN 2
        WHEN 'former'   THEN 1
        WHEN 'lost'     THEN 0
        ELSE 3
      END
    ) AS rk
  FROM clients c
  WHERE c.company_id IS NOT NULL
  GROUP BY c.company_id
)
UPDATE companies co
SET status = CASE r.rk
  WHEN 5 THEN 'active'
  WHEN 4 THEN 'warm'
  WHEN 3 THEN 'interest'
  WHEN 2 THEN 'cold'
  WHEN 1 THEN 'former'
  WHEN 0 THEN 'lost'
  ELSE 'interest'
END
FROM ranked r
WHERE co.id = r.company_id;

-- ============================================================================
-- FIN DE LA MIGRATION 034
-- ============================================================================
