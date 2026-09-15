-- ============================================================================
-- MOSTRA — Migration 031 : Plusieurs clients par projet
-- ============================================================================
-- Permet d'attacher PLUSIEURS clients à un même projet (ex. plusieurs
-- interlocuteurs côté client) — tous peuvent consulter, commenter et valider.
--
-- Principe (non-cassant) :
--   - `projects.client_id` reste le CLIENT PRINCIPAL (facturation / CRM / contact
--     principal). Tous les affichages existants continuent de fonctionner.
--   - Nouvelle table `project_clients` = l'ensemble des clients ayant accès.
--   - INVARIANT : le client principal (si défini) est toujours présent dans
--     `project_clients`. Garanti par un trigger + le backfill ci-dessous.
--   - Le contrôle d'accès (RLS, helpers auth, notifs) s'appuie sur `project_clients`.
--
-- Un client peut se connecter et agir uniquement s'il a un compte
-- (clients.profile_id non-null) — inchangé. La table ne fait que cumuler les
-- fiches CRM autorisées.
--
-- IMPORTANT :
--   - À exécuter dans le SQL Editor Supabase (une seule fois). Idempotent.
--   - Aucune perte de données. Les projets mono-client existants sont migrés.
-- ============================================================================


-- ============================================================================
-- 1. TABLE project_clients (lien N-N projet ↔ clients CRM)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_clients (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_project_clients_project ON project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client  ON project_clients(client_id);


-- ============================================================================
-- 2. BACKFILL — chaque projet déjà rattaché à un client le garde
-- ============================================================================

INSERT INTO project_clients (project_id, client_id)
SELECT id, client_id
FROM projects
WHERE client_id IS NOT NULL
ON CONFLICT (project_id, client_id) DO NOTHING;


-- ============================================================================
-- 3. TRIGGER — le client principal est toujours dans project_clients
-- ============================================================================
-- Quand projects.client_id est défini (INSERT) ou changé (UPDATE), on garantit
-- la présence de la ligne dans project_clients. On ne retire jamais l'ancien
-- principal ici : c'est l'admin qui décide de retirer un accès explicitement.

CREATE OR REPLACE FUNCTION sync_primary_project_client()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO project_clients (project_id, client_id)
    VALUES (NEW.id, NEW.client_id)
    ON CONFLICT (project_id, client_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS projects_sync_primary_client ON projects;
CREATE TRIGGER projects_sync_primary_client
  AFTER INSERT OR UPDATE OF client_id ON projects
  FOR EACH ROW EXECUTE FUNCTION sync_primary_project_client();


-- ============================================================================
-- 4. is_project_client() — suit désormais project_clients (+ fallback principal)
-- ============================================================================
-- Toutes les policies RLS existantes (project_phases, sub_phases, phase_blocks,
-- phase_files, comments) passent par cette fonction : les mettre à jour ici
-- suffit à ouvrir l'accès à TOUS les clients du projet.

CREATE OR REPLACE FUNCTION is_project_client(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_clients pc
    JOIN clients c ON c.id = pc.client_id
    WHERE pc.project_id = p_project_id
      AND c.profile_id = auth.uid()
  )
  OR EXISTS (
    -- Fallback : client principal direct (si trigger/backfill pas encore passés)
    SELECT 1
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_project_id
      AND c.profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- 5. RLS projects : un client voit un projet s'il en est l'un des clients
-- ============================================================================

DROP POLICY IF EXISTS "projects_select_own_client" ON projects;
CREATE POLICY "projects_select_own_client"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = projects.client_id AND c.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_clients pc
      JOIN clients c ON c.id = pc.client_id
      WHERE pc.project_id = projects.id AND c.profile_id = auth.uid()
    )
  );


-- ============================================================================
-- 6. RLS profiles : voir le PM de chacun de ses projets (multi-clients)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_pm_of_my_project" ON profiles;
CREATE POLICY "profiles_select_pm_of_my_project"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT p.project_manager_id
      FROM projects p
      WHERE p.project_manager_id IS NOT NULL
        AND is_project_client(p.id)
    )
  );


-- ============================================================================
-- 7. Storage : un client lit les fichiers d'un projet dont il fait partie
-- ============================================================================

DROP POLICY IF EXISTS "project_files_select" ON storage.objects;
CREATE POLICY "project_files_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      is_admin()
      OR is_project_client(((storage.foldername(name))[1])::uuid)
    )
  );


-- ============================================================================
-- 8. RLS sur project_clients
-- ============================================================================

ALTER TABLE project_clients ENABLE ROW LEVEL SECURITY;

-- Admin : tout
DROP POLICY IF EXISTS "project_clients_admin_all" ON project_clients;
CREATE POLICY "project_clients_admin_all"
  ON project_clients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Client : peut voir les lignes le concernant (lecture seule)
DROP POLICY IF EXISTS "project_clients_own_select" ON project_clients;
CREATE POLICY "project_clients_own_select"
  ON project_clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = project_clients.client_id AND c.profile_id = auth.uid()
    )
  );


-- ============================================================================
-- FIN DE LA MIGRATION 031
-- ============================================================================
-- Vérifications :
--   SELECT to_regclass('public.project_clients');                 -- non NULL
--   SELECT count(*) FROM project_clients;                         -- = nb projets avec client
--   -- Un projet peut maintenant avoir plusieurs lignes dans project_clients.
-- ============================================================================
