-- ============================================================================
-- MOSTRA — Migration 039 : liens clients « société + code »
-- ============================================================================
-- Nouveau format du lien client (choix Kylian, 2026-10-26) :
--   app.mostra.agency/client/monmiroir-7k2q             → vue d'ensemble
--   app.mostra.agency/client/monmiroir-7k2q/animation   → l'étape Animation
--   app.mostra.agency/client/monmiroir-lancement-7k2q   → si la société a
--                                                       plusieurs projets actifs
-- « monmiroir » = la société du client (companies.name, sinon
-- clients.company_name, sinon le nom du projet). « 7k2q » = code court
-- (4 caractères base32, ~1 million de combinaisons), présent dans TOUS les
-- liens. Régénérer le lien depuis l'admin change le code (l'ancien lien meurt).
--
-- Les liens déjà envoyés continuent de marcher : l'ancien token est gardé dans
-- `previous_share_tokens`, et le middleware redirige (308) vers le nouveau
-- format via la fonction `resolve_client_link` ci-dessous.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase, une fois, APRÈS un
-- backup. Idempotent : un projet déjà au nouveau format n'est pas retouché.
-- Le code de l'app fonctionne avant ET après cette migration.
-- ============================================================================


-- ── 1. Anciens tokens conservés pour la redirection ─────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS previous_share_tokens TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_projects_previous_share_tokens
  ON projects USING GIN (previous_share_tokens);


-- ── 2. Helpers : slug et code court ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION mostra_slug(input TEXT, max_len INT DEFAULT 30)
RETURNS TEXT AS $$
  SELECT NULLIF(
    left(
      trim(both '-' from regexp_replace(
        lower(translate(coalesce(input, ''),
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŸÿ',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYy')),
        '[^a-z0-9]+', '', 'g')),
      max_len),
    '')
$$ LANGUAGE sql IMMUTABLE;

-- Base32 sans caractères ambigus pour l'œil : a-z + 2-7.
CREATE OR REPLACE FUNCTION mostra_short_code()
RETURNS TEXT AS $$
  SELECT string_agg(substr('abcdefghijklmnopqrstuvwxyz234567', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 4)
$$ LANGUAGE sql VOLATILE;


-- ── 3. Conversion des projets existants ─────────────────────────────────────
-- Société : companies.name > clients.company_name > nom du projet.
-- Projet ajouté au lien seulement si la société a plusieurs projets actifs.

WITH labels AS (
  SELECT
    p.id,
    p.share_token,
    coalesce(mostra_slug(co.name), mostra_slug(c.company_name), mostra_slug(p.name), 'projet') AS company_slug,
    coalesce(mostra_slug(p.name, 24), 'projet') AS project_slug,
    p.status
  FROM projects p
  LEFT JOIN clients c    ON c.id = p.client_id
  LEFT JOIN companies co ON co.id = c.company_id
  WHERE p.share_token IS NULL OR p.share_token !~ '-[a-z2-7]{4}$'
),
counts AS (
  SELECT company_slug, count(*) FILTER (WHERE status = 'active') AS active_count
  FROM labels GROUP BY company_slug
)
UPDATE projects p
SET
  previous_share_tokens = CASE
    WHEN l.share_token IS NULL OR l.share_token = ANY (p.previous_share_tokens) THEN p.previous_share_tokens
    ELSE array_append(p.previous_share_tokens, l.share_token)
  END,
  share_token = l.company_slug
    || CASE WHEN cnt.active_count > 1 AND l.project_slug <> l.company_slug THEN '-' || l.project_slug ELSE '' END
    || '-' || mostra_short_code()
FROM labels l
JOIN counts cnt ON cnt.company_slug = l.company_slug
WHERE p.id = l.id;


-- ── 4. Résolution d'un ancien lien (appelée par le middleware, sans session) ─
-- Renvoie le token courant pour un token ancien OU courant, et le slug de
-- l'étape si un id d'étape est donné. Ne renvoie rien d'autre : aucun nom,
-- aucune donnée du projet. NULL si le token est inconnu.

CREATE OR REPLACE FUNCTION resolve_client_link(p_token TEXT, p_phase_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'token', p.share_token,
    'phase_slug', (SELECT ph.slug FROM project_phases ph WHERE ph.id = p_phase_id AND ph.project_id = p.id)
  )
  FROM projects p
  WHERE p.share_token = p_token OR p_token = ANY (p.previous_share_tokens)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION resolve_client_link(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_client_link(TEXT, UUID) TO anon, authenticated;

-- ============================================================================
-- FIN DE LA MIGRATION 039
-- ============================================================================
-- Vérification :
--   SELECT name, share_token, previous_share_tokens FROM projects ORDER BY updated_at DESC LIMIT 10;
--   → share_token du type « monmiroir-7k2q », l'ancien dans previous_share_tokens
--   SELECT resolve_client_link('<un ancien token>');
-- ============================================================================
