-- ============================================================================
-- MOSTRA — Migration 027 : plusieurs scripts par sous-phase « Script »
-- ============================================================================
-- Une sous-phase script peut désormais contenir plusieurs scripts (variantes).
-- Chaque script a ses propres sections (phase_blocks.script_id). Le client en
-- choisit un (is_selected). Les blocs gardent sub_phase_id (pour la RLS) + un
-- script_id.
--
-- Backfill : chaque sous-phase script existante devient 1 script (is_selected),
-- ses blocs reçoivent ce script_id → comportement identique (1 script).
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS scripts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_phase_id UUID        NOT NULL REFERENCES sub_phases(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'Script',
  description  TEXT,
  is_selected  BOOLEAN     NOT NULL DEFAULT false,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_sub_phase ON scripts(sub_phase_id, sort_order);

ALTER TABLE phase_blocks ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES scripts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_phase_blocks_script ON phase_blocks(script_id);

DROP TRIGGER IF EXISTS set_updated_at_scripts ON scripts;
CREATE TRIGGER set_updated_at_scripts BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scripts_select_admin ON scripts;
CREATE POLICY scripts_select_admin ON scripts FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS scripts_select_client ON scripts;
CREATE POLICY scripts_select_client ON scripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sub_phases sp
      JOIN project_phases pp ON pp.id = sp.phase_id
      WHERE sp.id = scripts.sub_phase_id
        AND is_project_client(pp.project_id)
    )
  );

DROP POLICY IF EXISTS scripts_write_admin ON scripts;
CREATE POLICY scripts_write_admin ON scripts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── Backfill : 1 script par sous-phase script existante ─────────────────────
DO $$
DECLARE r RECORD; new_id UUID;
BEGIN
  FOR r IN (
    SELECT DISTINCT sub_phase_id
    FROM phase_blocks
    WHERE type = 'script_section' AND sub_phase_id IS NOT NULL AND script_id IS NULL
  ) LOOP
    INSERT INTO scripts (sub_phase_id, title, is_selected, sort_order)
      VALUES (r.sub_phase_id, 'Script', true, 0)
      RETURNING id INTO new_id;

    UPDATE phase_blocks
      SET script_id = new_id
      WHERE type = 'script_section' AND sub_phase_id = r.sub_phase_id AND script_id IS NULL;
  END LOOP;
END $$;

-- ============================================================================
-- FIN DE LA MIGRATION 027
-- ============================================================================
