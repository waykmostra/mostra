-- ============================================================================
-- MOSTRA — Migration 025 : format des colonnes Nombre (Data)
-- ============================================================================
-- Permet de donner du sens à un score chiffré :
--   - number_format : 'raw' (brut) | 'rating' (note /N) | 'percent' (%) | 'currency' (€)
--   - number_max    : le N d'une note (ex. 5 pour « /5 ») — utilisé si rating
--
-- Dépend de la migration 024 (table data_columns). Idempotent.
-- IMPORTANT : à appliquer dans le SQL Editor Supabase.
-- ============================================================================

ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS number_format TEXT;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS number_max    NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_columns_number_format_check'
  ) THEN
    ALTER TABLE data_columns
      ADD CONSTRAINT data_columns_number_format_check
      CHECK (number_format IS NULL OR number_format IN ('raw', 'rating', 'percent', 'currency'));
  END IF;
END $$;

-- ============================================================================
-- FIN DE LA MIGRATION 025
-- ============================================================================
