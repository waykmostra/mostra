-- ============================================================================
-- MOSTRA — Migration 038 : Demandes de paiement (Stripe Checkout)
-- ============================================================================
-- L'admin crée, dans un projet, une ou plusieurs demandes de paiement
-- (« Acompte 50 % », « Solde »…). Le client paie chacune via une page Stripe
-- Checkout, depuis la page Paiement du portail ou un lien direct /pay/<token>.
--
--   - `payment_requests` : une demande = un libellé + un montant (en centimes).
--     Le montant n'est JAMAIS fourni par le navigateur : la session Checkout est
--     créée côté serveur à partir de cette ligne.
--   - `pay_token` : jeton aléatoire du lien direct (non devinable).
--   - `stripe_events` : événements webhook déjà traités (idempotence).
--   - notifications.type : ajout de 'payment_received'.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- ============================================================================


-- ── 1. Demandes de paiement ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_requests (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label                    TEXT        NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  -- Montant en centimes (minimum Stripe : 0,50 € ; plafond de sécurité : 1 M€).
  amount_cents             INT         NOT NULL CHECK (amount_cents BETWEEN 50 AND 100000000),
  currency                 TEXT        NOT NULL DEFAULT 'eur' CHECK (currency = 'eur'),
  status                   TEXT        NOT NULL DEFAULT 'open'
                                       CHECK (status IN ('open', 'paid', 'canceled')),
  pay_token                TEXT        NOT NULL UNIQUE,
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  paid_at                  TIMESTAMPTZ,
  -- Revenu créé dans Finance à l'encaissement.
  revenue_id               UUID        REFERENCES revenues(id) ON DELETE SET NULL,
  created_by               UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_project ON payment_requests(project_id, created_at);

DROP TRIGGER IF EXISTS set_updated_at ON payment_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_requests_admin_all"     ON payment_requests;
DROP POLICY IF EXISTS "payment_requests_select_client" ON payment_requests;
CREATE POLICY "payment_requests_admin_all"
  ON payment_requests FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "payment_requests_select_client"
  ON payment_requests FOR SELECT USING (is_project_client(project_id));


-- ── 2. Idempotence des webhooks ──────────────────────────────────────────────
-- Stripe peut renvoyer un même événement : on ne le traite qu'une fois.
-- Accès serveur uniquement (service role) : RLS activée, aucune policy.

CREATE TABLE IF NOT EXISTS stripe_events (
  id          TEXT        PRIMARY KEY,
  type        TEXT        NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;


-- ── 3. Type de notification « paiement reçu » ────────────────────────────────

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%comment_added%'
  LOOP
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'comment_added',
  'phase_approved',
  'revision_requested',
  'form_submitted',
  'phase_ready',
  'file_uploaded',
  'project_created',
  'member_joined',
  'payment_received'
));
