-- ============================================================================
-- MOSTRA — Migration 032 : Revenus libres (hors-projet)
-- ============================================================================
-- Jusqu'ici les revenus dérivaient UNIQUEMENT des projets (value_eur + paid_at).
-- Cette table permet d'enregistrer des revenus manuels qui ne passent pas par
-- un projet (prestation ponctuelle, formation, affiliation, sponsoring…).
-- Ils s'ajoutent au cashflow (KPIs + graphe) au même titre que les revenus projet.
--
-- IMPORTANT : à exécuter dans le SQL Editor Supabase (une fois). Idempotent.
-- Admin-only. Aucune table existante modifiée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenues (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT         NOT NULL,
  amount_eur  NUMERIC(10, 2) NOT NULL CHECK (amount_eur >= 0),
  /** Date d'encaissement (alimente le cashflow mensuel). */
  received_on DATE         NOT NULL DEFAULT CURRENT_DATE,
  category    TEXT         NOT NULL DEFAULT 'service'
                CHECK (category IN ('service', 'retainer', 'training', 'affiliate', 'other')),
  /** Client CRM optionnellement rattaché (sans passer par un projet). */
  client_id   UUID         REFERENCES clients(id) ON DELETE SET NULL,
  notes       TEXT,
  created_by  UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenues_received_on ON revenues(received_on DESC);
CREATE INDEX IF NOT EXISTS idx_revenues_client_id   ON revenues(client_id) WHERE client_id IS NOT NULL;

-- Réutilise la fonction trigger générique de la migration 020.
DROP TRIGGER IF EXISTS revenues_set_updated_at ON revenues;
CREATE TRIGGER revenues_set_updated_at
  BEFORE UPDATE ON revenues
  FOR EACH ROW EXECUTE FUNCTION finance_set_updated_at();

ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "revenues_admin_all" ON revenues;
CREATE POLICY "revenues_admin_all"
  ON revenues FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- FIN DE LA MIGRATION 032
-- ============================================================================
