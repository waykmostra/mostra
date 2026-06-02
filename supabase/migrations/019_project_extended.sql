-- ============================================================================
-- MOSTRA — Migration 019 : Vue Projet enrichie (P3)
-- ============================================================================
-- Objectif :
--   Ajouter les métadonnées business/finance manquantes sur `projects` afin
--   d'alimenter la carte 360° (au-dessus de la pipeline, qui reste intacte) :
--     - payment_status : statut de paiement du projet
--     - quote_url       : lien vers le devis (PDF, Notion, Drive…)
--     - invoice_url     : lien vers la facture
--
--   `deadline` et `value_eur` existent déjà (ajoutés en 018).
--
-- IMPORTANT :
--   - À exécuter dans le SQL Editor Supabase (une seule fois).
--   - Idempotent (ADD COLUMN IF NOT EXISTS). Aucune perte de données.
--   - N'impacte PAS le système de production (phases / sous-phases / fichiers).
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue', 'partial')),
  ADD COLUMN IF NOT EXISTS quote_url      TEXT,
  ADD COLUMN IF NOT EXISTS invoice_url    TEXT;

-- Index léger pour les futurs filtres Dashboard/Finance (P1/P4)
CREATE INDEX IF NOT EXISTS idx_projects_payment_status
  ON projects(payment_status);

-- ============================================================================
-- FIN DE LA MIGRATION 019
-- ============================================================================
-- Vérification :
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'projects'
--     AND column_name IN ('payment_status', 'quote_url', 'invoice_url');
--   → doit retourner 3 lignes (payment_status default 'pending')
-- ============================================================================
