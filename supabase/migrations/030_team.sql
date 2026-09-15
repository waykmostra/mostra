-- ============================================================================
-- MOSTRA — Migration 030 : Module Équipe (annuaire freelances)
-- ============================================================================
-- Annuaire privé des intervenants de l'agence (motion designers, voix off,
-- monteurs, DA, 3D, chefs de projet…). Calqué sur le CRM clients (migration
-- 018), MAIS sans compte auth : un membre d'équipe = une fiche que seul
-- l'admin voit et gère. Aucun 3ᵉ rôle (cohérent avec admin/client).
--
--   - team_roles         : métiers CONFIGURABLES (façon data_sets, migr. 024)
--   - team_members       : fiches des intervenants (identité, contact, tarifs,
--                          disponibilité)
--   - team_member_roles  : lien N-N membre ↔ métiers (un membre peut cumuler
--                          plusieurs métiers et apparaître dans plusieurs
--                          sections de l'annuaire)
--
-- PÉRIMÈTRE V1 : annuaire autonome uniquement. PAS d'assignation aux phases
-- de projet, PAS de charge auto-calculée, PAS de pont Finance (incréments 2-3).
-- Module 100 % additif : aucune table existante n'est modifiée.
--
-- IMPORTANT :
--   - À exécuter dans le SQL Editor Supabase (une seule fois).
--   - Idempotent. Aucune perte de données. RLS admin-only sur tout.
-- ============================================================================


-- ── Fonction trigger updated_at (isolée pour ce module) ──────────────────────

CREATE OR REPLACE FUNCTION team_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 1. team_roles — métiers configurables
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#00D76B',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_roles_sort ON team_roles(sort_order, created_at);

DROP TRIGGER IF EXISTS trg_team_roles_updated ON team_roles;
CREATE TRIGGER trg_team_roles_updated BEFORE UPDATE ON team_roles
  FOR EACH ROW EXECUTE FUNCTION team_touch_updated_at();

ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_roles_admin_all ON team_roles;
CREATE POLICY team_roles_admin_all ON team_roles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- 2. team_members — fiches des intervenants
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name     TEXT        NOT NULL,
  email            TEXT,
  phone            TEXT,
  portfolio_url    TEXT,
  /** Langues parlées, clé pour les voix off (champ libre : « FR, EN »). */
  languages        TEXT,
  /** Tarifs : les deux sont optionnels (préparent la future marge projet). */
  daily_rate_eur   NUMERIC(10, 2) CHECK (daily_rate_eur   IS NULL OR daily_rate_eur   >= 0),
  project_rate_eur NUMERIC(10, 2) CHECK (project_rate_eur IS NULL OR project_rate_eur >= 0),
  /** Disponibilité réglée à la main (la charge auto viendra avec l'incrément 2). */
  availability     TEXT        NOT NULL DEFAULT 'active'
                     CHECK (availability IN ('active', 'occasional', 'unavailable', 'on_leave')),
  /** Spécialités / tags libres. */
  tags             TEXT[],
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_availability ON team_members(availability);
CREATE INDEX IF NOT EXISTS idx_team_members_name         ON team_members(contact_name);

DROP TRIGGER IF EXISTS trg_team_members_updated ON team_members;
CREATE TRIGGER trg_team_members_updated BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION team_touch_updated_at();

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_members_admin_all ON team_members;
CREATE POLICY team_members_admin_all ON team_members
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- 3. team_member_roles — lien N-N membre ↔ métiers
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_member_roles (
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  role_id   UUID NOT NULL REFERENCES team_roles(id)   ON DELETE CASCADE,
  PRIMARY KEY (member_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_team_member_roles_role   ON team_member_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_team_member_roles_member ON team_member_roles(member_id);

ALTER TABLE team_member_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_member_roles_admin_all ON team_member_roles;
CREATE POLICY team_member_roles_admin_all ON team_member_roles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- 4. SEED — liste de métiers de départ (modifiable ensuite depuis l'UI)
-- ============================================================================
-- N'insère que si la table est vide (premier déploiement).

INSERT INTO team_roles (name, color, sort_order)
SELECT * FROM (VALUES
  ('Motion designer', '#00D76B', 0),
  ('Designer / DA',   '#3B82F6', 1),
  ('Voix off',        '#A78BFA', 2),
  ('Sound designer',  '#F59E0B', 3),
  ('Scénariste',      '#EC4899', 4),
  ('Monteur',         '#14B8A6', 5),
  ('3D',              '#F97316', 6),
  ('Chef de projet',  '#8B5CF6', 7)
) AS seed(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM team_roles);


-- ============================================================================
-- FIN DE LA MIGRATION 030
-- ============================================================================
-- Vérifications :
--   SELECT to_regclass('public.team_members'), to_regclass('public.team_roles'),
--          to_regclass('public.team_member_roles');     -- non NULL toutes
--   SELECT count(*) FROM team_roles;                    -- 8 (seed) au 1er run
-- ============================================================================
