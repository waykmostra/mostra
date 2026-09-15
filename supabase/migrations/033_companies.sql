-- ============================================================================
-- MOSTRA — Migration 033 : Sociétés (regrouper plusieurs clients)
-- ============================================================================
-- Permet de regrouper plusieurs fiches client sous une même entreprise
-- (ex. « Flowride » = 2 contacts). Une société = une entité avec sa fiche
-- (contacts rattachés, projets cumulés, CA cumulé).
--
--   - Table `companies`
--   - clients.company_id → companies.id (un client appartient à 0 ou 1 société)
--   - BACKFILL : crée une société par `company_name` distinct existant et y
--     rattache les fiches correspondantes (regroupement automatique).
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- Admin-only. Le champ texte clients.company_name est conservé (compat/affichage).
-- ============================================================================


-- ── 1. Table companies ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  website    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse (sert au backfill ON CONFLICT + évite les doublons).
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_lower ON companies (lower(name));

CREATE OR REPLACE FUNCTION companies_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_set_updated_at();

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_admin_all" ON companies;
CREATE POLICY "companies_admin_all"
  ON companies FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ── 2. clients.company_id ─────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id) WHERE company_id IS NOT NULL;


-- ── 3. BACKFILL — regroupe les fiches existantes par company_name ─────────────

-- 3a. Une société par nom de société distinct (non vide).
INSERT INTO companies (name)
SELECT DISTINCT trim(company_name)
FROM clients
WHERE company_name IS NOT NULL AND trim(company_name) <> ''
ON CONFLICT (lower(name)) DO NOTHING;

-- 3b. Rattache chaque fiche à sa société (match insensible à la casse).
UPDATE clients c
SET company_id = co.id
FROM companies co
WHERE c.company_id IS NULL
  AND c.company_name IS NOT NULL
  AND lower(trim(c.company_name)) = lower(co.name);


-- ============================================================================
-- FIN DE LA MIGRATION 033
-- ============================================================================
-- Vérifications :
--   SELECT to_regclass('public.companies');                         -- non NULL
--   SELECT count(*) FROM companies;                                 -- = nb de company_name distincts
--   SELECT c.name, count(*) FROM companies c JOIN clients cl ON cl.company_id = c.id
--     GROUP BY c.name ORDER BY count(*) DESC;                       -- regroupements
-- ============================================================================
