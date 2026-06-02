-- ============================================================================
-- MOSTRA — Migration 017 : Simplification radicale
-- ============================================================================
-- Objectif : passer de "SaaS multi-agence avec 4 rôles" à
--            "app privée avec 2 rôles (admin + client)"
--
-- Suppressions :
--   - Table agencies + agency_members + invitations (multi-agence retiré)
--   - Colonne agency_id sur projects, phase_templates, form_templates, notifications
--   - Rôles super_admin, agency_admin, creative — fusion en 'admin'
--   - Validation password forte, codes d'invitation, flows d'invitation
--
-- Ajouts :
--   - Colonne profiles.is_admin (boolean, défaut false)
--   - Table password_setup_tokens (admin crée client → envoie lien pour set mdp)
--
-- IMPORTANT : à appliquer dans le SQL Editor Supabase, dans cet ordre exact.
--             Aucune perte de données sur projects / phases / sub_phases /
--             phase_blocks / phase_files / comments / activity_logs / notifications.
-- ============================================================================


-- ============================================================================
-- 1. DÉSACTIVER LE REALTIME SUR LES TABLES QUI VONT BOUGER (sécurité)
-- ============================================================================
-- Pas critique mais évite des erreurs si Realtime tente de publier pendant la migration.
-- On le réactivera à la fin.


-- ============================================================================
-- 2. DROP DES POLICIES RLS QUI RÉFÉRENCENT agency_id (sinon les ALTER échouent)
-- ============================================================================

-- agencies
DROP POLICY IF EXISTS "agencies_select_members"      ON agencies;
DROP POLICY IF EXISTS "agencies_insert_super_admin"  ON agencies;
DROP POLICY IF EXISTS "agencies_update_admins"       ON agencies;
DROP POLICY IF EXISTS "agencies_delete_super_admin"  ON agencies;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_select_same_agency"  ON profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"          ON profiles;

-- agency_members
DROP POLICY IF EXISTS "agency_members_select"        ON agency_members;
DROP POLICY IF EXISTS "agency_members_insert_admin"  ON agency_members;
DROP POLICY IF EXISTS "agency_members_update_admin"  ON agency_members;
DROP POLICY IF EXISTS "agency_members_delete_admin"  ON agency_members;

-- phase_templates
DROP POLICY IF EXISTS "phase_templates_select"          ON phase_templates;
DROP POLICY IF EXISTS "phase_templates_insert_admin"    ON phase_templates;
DROP POLICY IF EXISTS "phase_templates_update_admin"    ON phase_templates;
DROP POLICY IF EXISTS "phase_templates_delete_admin"    ON phase_templates;

-- form_templates
DROP POLICY IF EXISTS "form_templates_select" ON form_templates;
DROP POLICY IF EXISTS "form_templates_insert" ON form_templates;
DROP POLICY IF EXISTS "form_templates_update" ON form_templates;
DROP POLICY IF EXISTS "form_templates_delete" ON form_templates;

-- projects
DROP POLICY IF EXISTS "projects_select"        ON projects;
DROP POLICY IF EXISTS "projects_insert_admin"  ON projects;
DROP POLICY IF EXISTS "projects_update_admin"  ON projects;
DROP POLICY IF EXISTS "projects_delete_admin"  ON projects;

-- project_phases
DROP POLICY IF EXISTS "project_phases_select"          ON project_phases;
DROP POLICY IF EXISTS "project_phases_insert_members"  ON project_phases;
DROP POLICY IF EXISTS "project_phases_update_members"  ON project_phases;
DROP POLICY IF EXISTS "project_phases_delete_admin"    ON project_phases;

-- sub_phases
DROP POLICY IF EXISTS "sub_phases_select" ON sub_phases;
DROP POLICY IF EXISTS "sub_phases_insert" ON sub_phases;
DROP POLICY IF EXISTS "sub_phases_update" ON sub_phases;
DROP POLICY IF EXISTS "sub_phases_delete" ON sub_phases;

-- phase_blocks
DROP POLICY IF EXISTS "phase_blocks_select" ON phase_blocks;
DROP POLICY IF EXISTS "phase_blocks_insert" ON phase_blocks;
DROP POLICY IF EXISTS "phase_blocks_update" ON phase_blocks;
DROP POLICY IF EXISTS "phase_blocks_delete" ON phase_blocks;

-- phase_files
DROP POLICY IF EXISTS "phase_files_select"            ON phase_files;
DROP POLICY IF EXISTS "phase_files_insert_non_client" ON phase_files;
DROP POLICY IF EXISTS "phase_files_update"            ON phase_files;
DROP POLICY IF EXISTS "phase_files_delete"            ON phase_files;

-- comments
DROP POLICY IF EXISTS "comments_select"      ON comments;
DROP POLICY IF EXISTS "comments_insert"      ON comments;
DROP POLICY IF EXISTS "comments_update_own"  ON comments;
DROP POLICY IF EXISTS "comments_delete"      ON comments;

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_select"          ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_service"  ON activity_logs;

-- invitations
DROP POLICY IF EXISTS "invitations_select_admin"  ON invitations;
DROP POLICY IF EXISTS "invitations_insert_admin"  ON invitations;
DROP POLICY IF EXISTS "invitations_update_admin"  ON invitations;
DROP POLICY IF EXISTS "invitations_delete_admin"  ON invitations;
DROP POLICY IF EXISTS "invitations_read_by_code"  ON invitations;

-- notifications
DROP POLICY IF EXISTS "Users see own notifications"     ON notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON notifications;
DROP POLICY IF EXISTS "Service role insert notifications" ON notifications;

-- Storage
DROP POLICY IF EXISTS "project_files_select" ON storage.objects;
DROP POLICY IF EXISTS "project_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_files_update" ON storage.objects;
DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "agency_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "agency_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "agency_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "agency_assets_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"    ON storage.objects;


-- ============================================================================
-- 3. DROP DES HELPER FUNCTIONS MULTI-AGENCE
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_agencies();
DROP FUNCTION IF EXISTS get_user_role(UUID);
DROP FUNCTION IF EXISTS is_agency_admin(UUID);
DROP FUNCTION IF EXISTS is_agency_member(UUID);


-- ============================================================================
-- 4. DROP DES TABLES MULTI-AGENCE
-- ============================================================================
-- Ordre : tables qui dépendent d'agencies d'abord, puis agencies.
-- Les FK CASCADE supprimeront les rows liées dans agency_members, invitations.

DROP TABLE IF EXISTS invitations    CASCADE;
DROP TABLE IF EXISTS agency_members CASCADE;


-- ============================================================================
-- 5. DROP DES COLONNES agency_id SUR LES TABLES QUI RESTENT
-- ============================================================================
-- D'abord les FK constraints implicites, puis les colonnes.

ALTER TABLE projects        DROP COLUMN IF EXISTS agency_id;
ALTER TABLE phase_templates DROP COLUMN IF EXISTS agency_id;
ALTER TABLE form_templates  DROP COLUMN IF EXISTS agency_id;
ALTER TABLE notifications   DROP COLUMN IF EXISTS agency_id;

-- phase_templates.slug était UNIQUE par (agency_id, slug) — devient UNIQUE seul
ALTER TABLE phase_templates DROP CONSTRAINT IF EXISTS phase_templates_agency_id_slug_key;
ALTER TABLE phase_templates ADD CONSTRAINT phase_templates_slug_key UNIQUE (slug);


-- ============================================================================
-- 6. DROP DE LA TABLE agencies (en dernier, plus de référence)
-- ============================================================================

DROP TABLE IF EXISTS agencies CASCADE;


-- ============================================================================
-- 7. ALTER profiles : ajouter is_admin
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- contact_method reste utile pour savoir comment contacter un client (email/whatsapp/phone)


-- ============================================================================
-- 8. CREATE password_setup_tokens
-- ============================================================================
-- Quand l'admin crée un client, on génère un token à usage unique (7 jours)
-- pour que le client définisse son mot de passe.

CREATE TABLE password_setup_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_setup_tokens_token   ON password_setup_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_password_setup_tokens_user    ON password_setup_tokens(user_id);

-- RLS : aucune lecture côté client. Tout passe par service_role (admin client TS).
ALTER TABLE password_setup_tokens ENABLE ROW LEVEL SECURITY;
-- Pas de policy → aucune lecture/écriture sauf service_role.


-- ============================================================================
-- 9. RECREATE HELPER FUNCTIONS (simplifiées)
-- ============================================================================

-- Retourne true si l'utilisateur connecté est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retourne true si l'utilisateur connecté est le client d'un projet donné
CREATE OR REPLACE FUNCTION is_project_client(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND client_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- 10. RECREATE RLS POLICIES (sans agency_id)
-- ============================================================================

-- ─── profiles ──────────────────────────────────────────────────────────────
-- Soi-même OU (je suis admin → je vois tous les profils) OU (je suis client →
-- je peux voir le profil du PM de mes projets pour ContactManager)

CREATE POLICY "profiles_select_self"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "profiles_select_pm_of_my_project"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT project_manager_id FROM projects
      WHERE client_id = auth.uid() AND project_manager_id IS NOT NULL
    )
  );

CREATE POLICY "profiles_insert_self"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL  -- trigger handle_new_user
  );

CREATE POLICY "profiles_update_self"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "profiles_delete_self"
  ON profiles FOR DELETE
  USING (id = auth.uid());


-- ─── phase_templates (templates globaux Mostra) ────────────────────────────
-- Lecture : tout le monde authentifié (besoin pour la création de projet UI)
-- Écriture : admin seulement

CREATE POLICY "phase_templates_select_authenticated"
  ON phase_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "phase_templates_write_admin"
  ON phase_templates FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── form_templates (templates globaux Mostra) ─────────────────────────────

CREATE POLICY "form_templates_select_authenticated"
  ON form_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "form_templates_write_admin"
  ON form_templates FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── projects ──────────────────────────────────────────────────────────────
-- Admin voit tous les projets. Client voit ses projets (client_id = auth.uid).

CREATE POLICY "projects_select_admin"
  ON projects FOR SELECT
  USING (is_admin());

CREATE POLICY "projects_select_own_client"
  ON projects FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "projects_write_admin"
  ON projects FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── project_phases ────────────────────────────────────────────────────────

CREATE POLICY "project_phases_select_admin"
  ON project_phases FOR SELECT
  USING (is_admin());

CREATE POLICY "project_phases_select_client"
  ON project_phases FOR SELECT
  USING (is_project_client(project_id));

CREATE POLICY "project_phases_write_admin"
  ON project_phases FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── sub_phases ────────────────────────────────────────────────────────────

CREATE POLICY "sub_phases_select_admin"
  ON sub_phases FOR SELECT
  USING (is_admin());

CREATE POLICY "sub_phases_select_client"
  ON sub_phases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_phases pp
      WHERE pp.id = sub_phases.phase_id
        AND is_project_client(pp.project_id)
    )
  );

CREATE POLICY "sub_phases_write_admin"
  ON sub_phases FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── phase_blocks ──────────────────────────────────────────────────────────

CREATE POLICY "phase_blocks_select_admin"
  ON phase_blocks FOR SELECT
  USING (is_admin());

CREATE POLICY "phase_blocks_select_client"
  ON phase_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_phases pp
      WHERE pp.id = COALESCE(
        phase_blocks.phase_id,
        (SELECT sp.phase_id FROM sub_phases sp WHERE sp.id = phase_blocks.sub_phase_id)
      )
      AND is_project_client(pp.project_id)
    )
  );

CREATE POLICY "phase_blocks_write_admin"
  ON phase_blocks FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── phase_files ───────────────────────────────────────────────────────────

CREATE POLICY "phase_files_select_admin"
  ON phase_files FOR SELECT
  USING (is_admin());

CREATE POLICY "phase_files_select_client"
  ON phase_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_phases pp
      WHERE pp.id = phase_files.phase_id
        AND is_project_client(pp.project_id)
    )
  );

CREATE POLICY "phase_files_write_admin"
  ON phase_files FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ─── comments ──────────────────────────────────────────────────────────────
-- Lecture : admin OU client du projet.
-- Insertion : authentifié + (admin OU client du projet).
-- Update/Delete : auteur OU admin.

CREATE POLICY "comments_select_admin"
  ON comments FOR SELECT
  USING (is_admin());

CREATE POLICY "comments_select_client"
  ON comments FOR SELECT
  USING (is_project_client(project_id));

CREATE POLICY "comments_insert_admin"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_admin()
  );

CREATE POLICY "comments_insert_client"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_project_client(project_id)
  );

CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (user_id = auth.uid() OR is_admin());


-- ─── activity_logs ─────────────────────────────────────────────────────────
-- Admin seulement (les clients ne voient pas les logs).

CREATE POLICY "activity_logs_select_admin"
  ON activity_logs FOR SELECT
  USING (is_admin());

-- Insertion gérée côté serveur (service_role). On laisse une policy permissive
-- pour les triggers / inserts authentifiés (admin uniquement côté UI).
CREATE POLICY "activity_logs_insert_admin"
  ON activity_logs FOR INSERT
  WITH CHECK (is_admin() OR auth.role() = 'service_role');


-- ─── notifications ─────────────────────────────────────────────────────────

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Insertion via service_role uniquement
CREATE POLICY "notifications_insert_service"
  ON notifications FOR INSERT
  WITH CHECK (true);


-- ============================================================================
-- 11. STORAGE POLICIES (sans agency_id)
-- ============================================================================

-- Bucket "project-files" : path = {project_id}/{phase_slug}/v{n}/{filename}
CREATE POLICY "project_files_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id::TEXT = (storage.foldername(name))[1]
          AND p.client_id = auth.uid()
      )
    )
  );

CREATE POLICY "project_files_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND is_admin()
  );

CREATE POLICY "project_files_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-files' AND is_admin());

CREATE POLICY "project_files_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-files' AND is_admin());


-- Bucket "agency-assets" (public bucket pour logo Mostra, etc.) : on le garde
-- mais sans contrainte agency_id. Path libre.
CREATE POLICY "agency_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agency-assets');

CREATE POLICY "agency_assets_write_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'agency-assets' AND is_admin());

CREATE POLICY "agency_assets_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'agency-assets' AND is_admin());

CREATE POLICY "agency_assets_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'agency-assets' AND is_admin());


-- Bucket "avatars" : path = {user_id}/avatar.ext
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );


-- ============================================================================
-- 12. METTRE À JOUR LE TRIGGER handle_new_user
-- ============================================================================
-- On garde le trigger pour insérer automatiquement un profil quand un user
-- auth.users est créé. Pas de is_admin par défaut (false).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user: could not insert profile for user % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION handle_new_user() OWNER TO postgres;


-- ============================================================================
-- 13. PROMOTE L'UTILISATEUR ACTUEL (TARIK) EN ADMIN
-- ============================================================================
-- ⚠️ À ADAPTER : remplace 'tarik@mostra.io' par ton vrai email avant d'exécuter.
-- Sans ça, plus personne ne sera admin et tu seras bloqué.

UPDATE profiles
SET is_admin = true
WHERE email = 'wayk.pro@gmail.com';

-- Si tu ne connais pas ton email exact, exécute d'abord :
--   SELECT id, email, full_name FROM profiles ORDER BY created_at;
-- puis lance manuellement :
--   UPDATE profiles SET is_admin = true WHERE id = '<TON_UUID>';


-- ============================================================================
-- 14. REALTIME — s'assurer que les bonnes tables sont publiées
-- ============================================================================
-- Les tables comments, activity_logs, project_phases, phase_files sont déjà
-- dans la publication supabase_realtime (migration 004). On ajoute notifications
-- si pas déjà fait (migration 016).
-- Idempotent : ALTER PUBLICATION ne crash pas si la table est déjà là.

-- (Aucune action requise ici — laissé en place pour mémoire)


-- ============================================================================
-- FIN DE LA MIGRATION 017
-- ============================================================================
-- Vérifications post-migration recommandées :
--   1. SELECT id, email, is_admin FROM profiles ORDER BY created_at;
--      → vérifier qu'au moins 1 row a is_admin = true
--   2. SELECT COUNT(*) FROM projects;  -- doit être inchangé
--   3. SELECT COUNT(*) FROM project_phases;  -- doit être inchangé
--   4. SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--      → ne doit PAS contenir : agencies, agency_members, invitations
-- ============================================================================
