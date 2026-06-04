-- ============================================================================
-- MOSTRA — Migration 024 : Data (bases de statistiques personnalisables)
-- ============================================================================
-- Mini-datasets façon Airtable, pour tracker des données à la main et les
-- analyser sous forme de graphiques.
--   - data_sets    : une base (ex. « Messages de prospection »)
--   - data_columns : colonnes définies par l'utilisateur (nom + type)
--                    type ∈ number | category | text ; options = choix (category)
--   - data_entries : lignes ; values JSONB = { "<column_id>": valeur }
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase. Idempotent.
-- ============================================================================


CREATE OR REPLACE FUNCTION founder_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 1. data_sets ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_sets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#00D76B',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_sets_sort ON data_sets(sort_order, created_at);

DROP TRIGGER IF EXISTS trg_data_sets_updated ON data_sets;
CREATE TRIGGER trg_data_sets_updated BEFORE UPDATE ON data_sets
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE data_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_sets_admin_all ON data_sets;
CREATE POLICY data_sets_admin_all ON data_sets
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 2. data_columns ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_columns (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     UUID        NOT NULL REFERENCES data_sets(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'text'
    CHECK (type IN ('number', 'category', 'text')),
  options    JSONB,      -- liste de choix pour type 'category' : ["réussi","échoué"]
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_columns_set ON data_columns(set_id, sort_order);

ALTER TABLE data_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_columns_admin_all ON data_columns;
CREATE POLICY data_columns_admin_all ON data_columns
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 3. data_entries ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     UUID        NOT NULL REFERENCES data_sets(id) ON DELETE CASCADE,
  values     JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_entries_set ON data_entries(set_id, created_at);

DROP TRIGGER IF EXISTS trg_data_entries_updated ON data_entries;
CREATE TRIGGER trg_data_entries_updated BEFORE UPDATE ON data_entries
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE data_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_entries_admin_all ON data_entries;
CREATE POLICY data_entries_admin_all ON data_entries
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- FIN DE LA MIGRATION 024
-- ============================================================================
