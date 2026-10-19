-- ============================================================================
-- MOSTRA — Migration 037 : Cadrage (page modulable du projet)
-- ============================================================================
-- Le Cadrage est la première étape d'un projet, ouverte à la signature, juste
-- avant le R3. C'est un brouillon commun admin/client : une grille « bento »
-- que seul l'admin compose, et que le client lit et commente.
--
-- Il n'entre pas dans le pipeline des phases (pas de statut, pas de
-- validation, pas d'impact sur l'avancement) : il reste ouvert pendant tout le
-- projet. D'où un rattachement direct au projet, pas à `project_phases`.
--
--   - `board_columns`  : les colonnes de la grille (largeur sur 12).
--   - `board_sections` : les sections empilées dans une colonne
--                        (type media / text / documents, hauteur réglable).
--   - `board_items`    : le contenu d'une section (texte, image, vidéo, lien,
--                        fichier). `section_id` NULL = « À trier », la boîte
--                        de réception de l'admin, jamais visible du client.
--   - `comments.board_section_id` / `comments.board_item_id` : commentaires
--                        du client sur une section ou un élément.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- ============================================================================


-- ── 1. Colonnes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_columns (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Largeur sur une grille de 12 (desktop). Sur mobile, les colonnes s'empilent.
  width      SMALLINT    NOT NULL DEFAULT 6 CHECK (width BETWEEN 1 AND 12),
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_columns_project ON board_columns(project_id, sort_order);


-- ── 2. Sections ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_sections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dénormalisé depuis la colonne : sert aux policies RLS sans jointure.
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id  UUID        NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('media', 'text', 'documents')),
  title      TEXT,
  -- Hauteur en px fixée par l'admin ; NULL = la section suit son contenu.
  height     INT         CHECK (height IS NULL OR height BETWEEN 80 AND 2000),
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_sections_column  ON board_sections(column_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_board_sections_project ON board_sections(project_id);


-- ── 3. Éléments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- NULL = « À trier » (admin uniquement). Supprimer une section renvoie ses
  -- éléments à trier plutôt que de les perdre.
  section_id UUID        REFERENCES board_sections(id) ON DELETE SET NULL,
  kind       TEXT        NOT NULL CHECK (kind IN ('text', 'image', 'video', 'link', 'file')),
  -- text  : { text }
  -- image / video / file : { storage_path, file_name, caption? }
  -- link  : { url, title?, note? }
  content    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT         NOT NULL DEFAULT 0,
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_items_section ON board_items(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_board_items_inbox   ON board_items(project_id, created_at)
  WHERE section_id IS NULL;


-- ── 4. updated_at ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at ON board_columns;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON board_columns
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON board_sections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON board_sections
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON board_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON board_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ── 5. RLS : l'admin compose, le client lit (hors « À trier ») ───────────────

ALTER TABLE board_columns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_columns_admin_all"     ON board_columns;
DROP POLICY IF EXISTS "board_columns_select_client" ON board_columns;
CREATE POLICY "board_columns_admin_all"
  ON board_columns FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "board_columns_select_client"
  ON board_columns FOR SELECT USING (is_project_client(project_id));

DROP POLICY IF EXISTS "board_sections_admin_all"     ON board_sections;
DROP POLICY IF EXISTS "board_sections_select_client" ON board_sections;
CREATE POLICY "board_sections_admin_all"
  ON board_sections FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "board_sections_select_client"
  ON board_sections FOR SELECT USING (is_project_client(project_id));

DROP POLICY IF EXISTS "board_items_admin_all"     ON board_items;
DROP POLICY IF EXISTS "board_items_select_client" ON board_items;
CREATE POLICY "board_items_admin_all"
  ON board_items FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "board_items_select_client"
  ON board_items FOR SELECT
  USING (section_id IS NOT NULL AND is_project_client(project_id));


-- ── 6. Commentaires sur le Cadrage ───────────────────────────────────────────
-- Les policies existantes de `comments` (par project_id) couvrent déjà le
-- client : il peut commenter un projet dont il fait partie.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS board_section_id UUID REFERENCES board_sections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS board_item_id    UUID REFERENCES board_items(id)    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_board_section ON comments(board_section_id) WHERE board_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_board_item    ON comments(board_item_id)    WHERE board_item_id IS NOT NULL;
