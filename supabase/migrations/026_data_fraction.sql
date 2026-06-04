-- ============================================================================
-- MOSTRA — Migration 026 : format « fraction » pour les colonnes Nombre (Data)
-- ============================================================================
-- Ajoute le format 'fraction' : la valeur est saisie littéralement « 1/5 »,
-- « 4/8 »… (dénominateur par entrée). La comparaison se fait sur le ratio.
--
-- Auto-suffisante : (re)crée les colonnes au besoin puis met à jour le CHECK.
-- Idempotent. À appliquer dans le SQL Editor Supabase.
-- ============================================================================

ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS number_format TEXT;
ALTER TABLE data_columns ADD COLUMN IF NOT EXISTS number_max    NUMERIC;

ALTER TABLE data_columns DROP CONSTRAINT IF EXISTS data_columns_number_format_check;
ALTER TABLE data_columns
  ADD CONSTRAINT data_columns_number_format_check
  CHECK (number_format IS NULL OR number_format IN ('raw', 'rating', 'percent', 'currency', 'fraction'));

-- ============================================================================
-- FIN DE LA MIGRATION 026
-- ============================================================================
