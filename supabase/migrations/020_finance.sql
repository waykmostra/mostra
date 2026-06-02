-- ============================================================================
-- MOSTRA — Migration 020 : Gestion Finance / Cashflow (P4 — sans partie admin)
-- ============================================================================
-- Périmètre VOLONTAIREMENT limité au cashflow (pas de TVA / URSSAF / devis) :
--   - projects.paid_at : date d'encaissement (alimente le récap mensuel exact)
--   - expenses          : dépenses ponctuelles (optionnellement liées à un projet)
--   - subscriptions     : abonnements récurrents (mensuels / annuels)
--
-- Les REVENUS ne sont pas dupliqués : ils dérivent des projets
-- (projects.value_eur + payment_status = 'paid' + paid_at).
--
-- IMPORTANT :
--   - À exécuter dans le SQL Editor Supabase (une seule fois).
--   - Idempotent. Aucune perte de données.
--   - N'impacte PAS le système de production.
-- ============================================================================


-- ============================================================================
-- 1. projects.paid_at — date d'encaissement
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill : si des projets sont déjà "payés", on date l'encaissement à la
-- dernière mise à jour (meilleure approximation disponible).
UPDATE projects
SET paid_at = updated_at
WHERE payment_status = 'paid' AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_paid_at
  ON projects(paid_at) WHERE paid_at IS NOT NULL;


-- ============================================================================
-- 2. Fonction trigger updated_at (générique finance)
-- ============================================================================

CREATE OR REPLACE FUNCTION finance_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. TABLE expenses — dépenses ponctuelles
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT         NOT NULL,
  amount_eur   NUMERIC(10, 2) NOT NULL CHECK (amount_eur >= 0),
  category     TEXT         NOT NULL DEFAULT 'other'
                 CHECK (category IN (
                   'software', 'hardware', 'subcontracting', 'marketing', 'office', 'other'
                 )),
  incurred_on  DATE         NOT NULL DEFAULT CURRENT_DATE,
  /** Optionnel : rattache la dépense à un projet (rentabilité projet). */
  project_id   UUID         REFERENCES projects(id) ON DELETE SET NULL,
  notes        TEXT,
  created_by   UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_incurred_on ON expenses(incurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id  ON expenses(project_id) WHERE project_id IS NOT NULL;

DROP TRIGGER IF EXISTS expenses_set_updated_at ON expenses;
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION finance_set_updated_at();


-- ============================================================================
-- 4. TABLE subscriptions — abonnements récurrents
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT         NOT NULL,
  amount_eur    NUMERIC(10, 2) NOT NULL CHECK (amount_eur >= 0),
  billing_cycle TEXT         NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly', 'yearly')),
  category      TEXT         NOT NULL DEFAULT 'software'
                  CHECK (category IN (
                    'software', 'hardware', 'subcontracting', 'marketing', 'office', 'other'
                  )),
  active        BOOLEAN      NOT NULL DEFAULT true,
  started_on    DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active) WHERE active = true;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION finance_set_updated_at();


-- ============================================================================
-- 5. RLS — admin uniquement (données financières privées)
-- ============================================================================

ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_admin_all" ON expenses;
CREATE POLICY "expenses_admin_all"
  ON expenses FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "subscriptions_admin_all" ON subscriptions;
CREATE POLICY "subscriptions_admin_all"
  ON subscriptions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================================
-- FIN DE LA MIGRATION 020
-- ============================================================================
-- Vérifications :
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'projects' AND column_name = 'paid_at';        -- 1 ligne
--   SELECT to_regclass('public.expenses'), to_regclass('public.subscriptions');
--     -- doivent être non NULL
-- ============================================================================
