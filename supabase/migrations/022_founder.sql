-- ============================================================================
-- MOSTRA — Migration 022 : Cockpit Founder
-- ============================================================================
-- Tables du pilotage personnel (admin-only) :
--   - daily_workflow_tasks   : définitions des tâches quotidiennes (éditable)
--   - daily_workflow_log      : cochage par jour (présence = fait)
--   - objectives              : objectifs avec deadline + cible
--   - weekly_kpis             : revue hebdo (vendredi)
--   - competitors             : veille concurrentielle
--   - content_ideas           : inbox d'idées de contenu
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase. Idempotent.
-- ============================================================================


-- ── Fonction utilitaire updated_at ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION founder_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 1. daily_workflow_tasks ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_workflow_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT        NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dwt_active ON daily_workflow_tasks(active, sort_order);

ALTER TABLE daily_workflow_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dwt_admin_all ON daily_workflow_tasks;
CREATE POLICY dwt_admin_all ON daily_workflow_tasks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed des défauts (uniquement si la table est vide)
INSERT INTO daily_workflow_tasks (label, sort_order)
SELECT v.label, v.sort_order FROM (VALUES
  ('Post LinkedIn', 1),
  ('Post Instagram', 2),
  ('Post X', 3),
  ('Messages outreach', 4),
  ('Connexions LinkedIn', 5),
  ('Leads identifiés', 6),
  ('MIT du jour', 7)
) AS v(label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM daily_workflow_tasks);


-- ── 2. daily_workflow_log ───────────────────────────────────────────────────
-- Présence d'une ligne = tâche cochée ce jour-là. Reset "à minuit" = on lit
-- simplement les lignes du jour courant.

CREATE TABLE IF NOT EXISTS daily_workflow_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES daily_workflow_tasks(id) ON DELETE CASCADE,
  done_on    DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, done_on)
);

CREATE INDEX IF NOT EXISTS idx_dwl_done_on ON daily_workflow_log(done_on);

ALTER TABLE daily_workflow_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dwl_admin_all ON daily_workflow_log;
CREATE POLICY dwl_admin_all ON daily_workflow_log
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 3. objectives ───────────────────────────────────────────────────────────
-- metric : 'manual' (saisie libre) ou liée aux données (calcul auto à la lecture)
--   revenue_month   → CA encaissé le mois courant (Finance)
--   new_leads_month → fiches clients créées le mois courant (CRM)
--   calls_booked    → prospects au stade call_booke (Pipeline)

CREATE TABLE IF NOT EXISTS objectives (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT        NOT NULL,
  metric       TEXT        NOT NULL DEFAULT 'manual'
    CHECK (metric IN ('manual', 'revenue_month', 'new_leads_month', 'calls_booked')),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (target_value >= 0),
  manual_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (manual_value >= 0),
  deadline     DATE,
  is_priority  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objectives_priority ON objectives(is_priority) WHERE is_priority = true;

DROP TRIGGER IF EXISTS trg_objectives_updated ON objectives;
CREATE TRIGGER trg_objectives_updated BEFORE UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS objectives_admin_all ON objectives;
CREATE POLICY objectives_admin_all ON objectives
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 4. weekly_kpis ──────────────────────────────────────────────────────────
-- week_start = lundi de la semaine (UNIQUE). CA signé + deals = calculés à la
-- lecture depuis Finance/CRM (non stockés).

CREATE TABLE IF NOT EXISTS weekly_kpis (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start          DATE        UNIQUE NOT NULL,
  prospects_contacted INT         NOT NULL DEFAULT 0,
  replies             INT         NOT NULL DEFAULT 0,
  calls_held          INT         NOT NULL DEFAULT 0,
  posts_linkedin      INT         NOT NULL DEFAULT 0,
  posts_instagram     INT         NOT NULL DEFAULT 0,
  what_worked         TEXT,
  what_didnt          TEXT,
  one_change          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_kpis_week ON weekly_kpis(week_start DESC);

DROP TRIGGER IF EXISTS trg_weekly_kpis_updated ON weekly_kpis;
CREATE TRIGGER trg_weekly_kpis_updated BEFORE UPDATE ON weekly_kpis
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE weekly_kpis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weekly_kpis_admin_all ON weekly_kpis;
CREATE POLICY weekly_kpis_admin_all ON weekly_kpis
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 5. competitors ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competitors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  website       TEXT,
  positioning   TEXT,
  their_methods TEXT,
  replicate     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_updated ON competitors(updated_at DESC);

DROP TRIGGER IF EXISTS trg_competitors_updated ON competitors;
CREATE TRIGGER trg_competitors_updated BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS competitors_admin_all ON competitors;
CREATE POLICY competitors_admin_all ON competitors
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ── 6. content_ideas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_ideas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT        NOT NULL,
  platform   TEXT        NOT NULL DEFAULT 'linkedin'
    CHECK (platform IN ('linkedin', 'instagram', 'x')),
  status     TEXT        NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'in_progress', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_status ON content_ideas(status);

DROP TRIGGER IF EXISTS trg_content_ideas_updated ON content_ideas;
CREATE TRIGGER trg_content_ideas_updated BEFORE UPDATE ON content_ideas
  FOR EACH ROW EXECUTE FUNCTION founder_touch_updated_at();

ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_ideas_admin_all ON content_ideas;
CREATE POLICY content_ideas_admin_all ON content_ideas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- FIN DE LA MIGRATION 022
-- ============================================================================
