-- ============================================================================
-- MOSTRA — Migration 023 : Notes (groupes + notes texte libre)
-- ============================================================================
-- Remplace l'usage de `content_ideas` par un système de Notes :
--   - note_groups : groupes personnalisables (nom + couleur)
--   - notes       : notes en texte libre rangées dans un groupe
--
-- Backfill : les content_ideas existantes sont migrées dans un groupe « Idées »
-- (une seule fois). La table content_ideas n'est PAS supprimée (sécurité).
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase. Idempotent.
-- ============================================================================


-- Fonction utilitaire updated_at (déjà créée en 022 ; recréée par sécurité).
CREATE OR REPLACE FUNCTION founder_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 1. note_groups ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS note_groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#00D76B',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_groups_sort ON note_groups(sort_order, created_at);

DROP TRIGGER IF EXISTS trg_note_groups_updated ON note_groups;
CREATE TRIGGER trg_note_groups_updated BEFORE UPDATE ON note_groups
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE note_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS note_groups_admin_all ON note_groups;
CREATE POLICY note_groups_admin_all ON note_groups
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 2. notes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES note_groups(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL DEFAULT '',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_notes_updated ON notes;
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notes_admin_all ON notes;
CREATE POLICY notes_admin_all ON notes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 3. Backfill content_ideas → groupe « Idées » ────────────────────────────
-- Une seule fois : si des idées existent et qu'aucun groupe « Idées » n'existe.

DO $$
DECLARE g_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM content_ideas)
     AND NOT EXISTS (SELECT 1 FROM note_groups WHERE name = 'Idées')
  THEN
    INSERT INTO note_groups (name, color, sort_order)
      VALUES ('Idées', '#F59E0B', 0)
      RETURNING id INTO g_id;

    INSERT INTO notes (group_id, content, created_at, updated_at)
      SELECT g_id, content, created_at, updated_at
      FROM content_ideas
      ORDER BY created_at;
  END IF;
END $$;


-- ============================================================================
-- FIN DE LA MIGRATION 023
-- ============================================================================
