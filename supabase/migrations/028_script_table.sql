-- ============================================================================
-- MOSTRA — Migration 028 : Script en TABLEAU (résumé + tableau)
-- ============================================================================
-- L'éditeur de script passe des « cartes » à un modèle TABLEAU (repris du
-- Mostra Compagnon) : colonnes taguées, catégories, lignes.
--
-- Choix d'archi (zéro casse) :
--   • Le LAYOUT du tableau (colonnes / catégories / beats) vit sur la ligne
--     `scripts` (3 nouvelles colonnes JSONB ci-dessous).
--   • Les LIGNES du tableau restent des `phase_blocks` (type='script_section',
--     script_id) — leur id sert d'ancre aux commentaires (comments.block_id est
--     une FK vers phase_blocks). Le `content` d'une ligne devient :
--         { "categoryId": "<id catégorie>", "cells": { "<colId>": "texte" } }
--     (l'ancien format { title, color, content, description, vo } reste lisible :
--      l'app le migre à la volée à l'ouverture, voir src/lib/scriptTable.ts).
--
-- Aucune table supprimée, aucune contrainte modifiée. Idempotent.
-- À appliquer dans le SQL Editor Supabase.
-- ============================================================================

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS columns    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS beats      JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- FIN DE LA MIGRATION 028
-- ============================================================================
