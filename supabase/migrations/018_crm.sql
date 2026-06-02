-- ============================================================================
-- MOSTRA — Migration 018 : CRM Clients (P2) + meta projet (P1/P3 anticipés)
-- ============================================================================
-- Objectif :
--   - Créer une vraie table `clients` (CRM) séparée de `profiles` (auth)
--   - Un prospect (cold/interest/warm) n'a PAS de compte auth — pas de profile
--   - Un client signé peut avoir un profile lié via clients.profile_id
--   - `projects.client_id` pointe désormais vers `clients.id` (au lieu de profiles)
--   - RLS / helpers / storage policies mis à jour pour suivre la nouvelle relation
--
-- Ajouts P1/P3 anticipés (cohérent, évite une 2e migration) :
--   - projects.deadline DATE
--   - projects.value_eur NUMERIC(10,2)
--
-- IMPORTANT :
--   - À exécuter dans le SQL Editor Supabase (une seule fois)
--   - Aucune perte de données. Les projets existants seront re-liés
--     automatiquement aux clients créés depuis les profils non-admin.
-- ============================================================================


-- ============================================================================
-- 1. TABLE clients
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name          TEXT,
  contact_name          TEXT         NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  website               TEXT,
  source                TEXT         NOT NULL DEFAULT 'other'
                          CHECK (source IN (
                            'instagram', 'linkedin', 'word_of_mouth',
                            'website', 'referral', 'cold_outreach', 'other'
                          )),
  status                TEXT         NOT NULL DEFAULT 'interest'
                          CHECK (status IN (
                            'cold', 'interest', 'warm', 'active', 'former', 'lost'
                          )),
  last_message_sent_at  TIMESTAMPTZ,
  last_reply_at         TIMESTAMPTZ,
  follow_up_pending     BOOLEAN      NOT NULL DEFAULT false,
  notes                 TEXT,
  /** Lié au profile auth quand un compte a été créé pour ce client. NULL = prospect. */
  profile_id            UUID         UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_status     ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON clients(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email      ON clients(email)      WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_follow_up  ON clients(follow_up_pending) WHERE follow_up_pending = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at_clients()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_clients();


-- ============================================================================
-- 2. TABLE client_interactions (timeline d'échanges)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_interactions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID         NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type          TEXT         NOT NULL
                  CHECK (type IN (
                    'message_sent', 'message_received', 'call', 'meeting', 'note', 'email'
                  )),
  content       TEXT         NOT NULL,
  channel       TEXT,
  occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by    UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_client_id
  ON client_interactions(client_id, occurred_at DESC);


-- ============================================================================
-- 3. AJOUTS sur `projects` (P1 & P3 anticipés)
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deadline   DATE,
  ADD COLUMN IF NOT EXISTS value_eur  NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_projects_deadline
  ON projects(deadline) WHERE deadline IS NOT NULL;


-- ============================================================================
-- 4. MIGRATION DES DONNÉES EXISTANTES
-- ============================================================================
-- Pour chaque profile non-admin existant, on crée un clients row lié.
-- Puis on met à jour projects.client_id pour pointer vers clients.id.

-- 4a. Créer un clients pour chaque profil non-admin (idempotent via ON CONFLICT)
INSERT INTO clients (contact_name, email, phone, source, status, profile_id, created_at)
SELECT
  COALESCE(NULLIF(p.full_name, ''), split_part(p.email, '@', 1)),
  p.email,
  p.phone,
  'other',
  'active',
  p.id,
  p.created_at
FROM profiles p
WHERE p.is_admin = false
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.profile_id = p.id);

-- 4b. Update projects.client_id : remplacer profile.id par clients.id
-- D'abord drop l'ancienne FK
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;

-- Re-mapping : projects.client_id (= profile.id) → clients.id (où clients.profile_id = profile.id)
UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NOT NULL
  AND c.profile_id = p.client_id;

-- Si un projet pointait vers un profil supprimé (orphelin), client_id devient NULL implicitement
-- car aucun match dans clients.profile_id. On le nettoie explicitement :
UPDATE projects
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = projects.client_id);

-- Recréer la FK vers clients (avec ON DELETE SET NULL : un client supprimé laisse ses projets vivants)
ALTER TABLE projects
  ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;


-- ============================================================================
-- 5. METTRE À JOUR is_project_client() — suit clients.profile_id
-- ============================================================================

CREATE OR REPLACE FUNCTION is_project_client(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    JOIN clients  c ON c.id = p.client_id
    WHERE p.id = p_project_id
      AND c.profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- 6. METTRE À JOUR LES RLS POLICIES qui référencent projects.client_id
-- ============================================================================

-- ─── projects ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select_own_client" ON projects;

CREATE POLICY "projects_select_own_client"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = projects.client_id
        AND c.profile_id = auth.uid()
    )
  );

-- ─── profiles : "voir le PM de mes projets" ────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_pm_of_my_project" ON profiles;

CREATE POLICY "profiles_select_pm_of_my_project"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT p.project_manager_id
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.profile_id = auth.uid()
        AND p.project_manager_id IS NOT NULL
    )
  );

-- ─── storage : project_files_select pour client ────────────────────────────
DROP POLICY IF EXISTS "project_files_select" ON storage.objects;

CREATE POLICY "project_files_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1
        FROM projects p
        JOIN clients c ON c.id = p.client_id
        WHERE p.id::TEXT = (storage.foldername(name))[1]
          AND c.profile_id = auth.uid()
      )
    )
  );


-- ============================================================================
-- 7. RLS sur les nouvelles tables `clients` et `client_interactions`
-- ============================================================================

ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_interactions  ENABLE ROW LEVEL SECURITY;

-- Admin : tout
CREATE POLICY "clients_admin_all"
  ON clients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Client connecté : lecture seule de son propre fiche (utile si on ajoute
-- un "Mon compte" enrichi côté client)
CREATE POLICY "clients_own_select"
  ON clients FOR SELECT
  USING (profile_id = auth.uid());

-- Interactions : admin seulement (privé)
CREATE POLICY "client_interactions_admin_all"
  ON client_interactions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================================
-- 8. REALTIME (optionnel — pour le Kanban en temps réel si besoin futur)
-- ============================================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE clients;
-- ALTER PUBLICATION supabase_realtime ADD TABLE client_interactions;
-- (Laissé commenté — à activer plus tard si besoin)


-- ============================================================================
-- FIN DE LA MIGRATION 018
-- ============================================================================
-- Vérifications post-migration :
--   1. SELECT count(*) FROM clients;
--      → doit correspondre au nb de profiles non-admin
--   2. SELECT count(*) FROM projects WHERE client_id IS NOT NULL;
--      → doit correspondre au nb de projets liés avant la migration
--   3. SELECT p.name, c.contact_name
--      FROM projects p JOIN clients c ON c.id = p.client_id
--      LIMIT 5;
--      → les liens projets↔clients sont correctement re-mappés
--   4. SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'projects' AND column_name IN ('deadline', 'value_eur');
--      → doit retourner 2 lignes
-- ============================================================================
