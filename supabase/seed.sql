-- ============================================================
-- MOSTRA — Seed data (données de démo)
-- ============================================================
-- Note : les auth.users sont créés manuellement ici pour le
-- développement local (Supabase CLI). En production, les
-- utilisateurs s'inscrivent via l'interface.
-- ============================================================

-- UUIDs fixes pour la reproductibilité
DO $$
DECLARE
  -- Agence
  agency_id        UUID := '11111111-1111-1111-1111-111111111111';

  -- Utilisateurs
  user_super_admin UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
  user_admin       UUID := 'aaaaaaaa-0000-0000-0000-000000000002';
  user_creative_1  UUID := 'aaaaaaaa-0000-0000-0000-000000000003';
  user_creative_2  UUID := 'aaaaaaaa-0000-0000-0000-000000000004';
  user_client      UUID := 'aaaaaaaa-0000-0000-0000-000000000005';

  -- Phase templates
  tpl_script    UUID := 'bbbbbbbb-0000-0000-0000-000000000001';
  tpl_design    UUID := 'bbbbbbbb-0000-0000-0000-000000000002';
  tpl_animation UUID := 'bbbbbbbb-0000-0000-0000-000000000003';
  tpl_render    UUID := 'bbbbbbbb-0000-0000-0000-000000000004';

  -- Projets
  proj_1 UUID := 'cccccccc-0000-0000-0000-000000000001';
  proj_2 UUID := 'cccccccc-0000-0000-0000-000000000002';
  proj_3 UUID := 'cccccccc-0000-0000-0000-000000000003';

  -- Phases projet 1 (TechVision)
  phase_1_script    UUID := 'dddddddd-1111-0000-0000-000000000001';
  phase_1_design    UUID := 'dddddddd-1111-0000-0000-000000000002';
  phase_1_animation UUID := 'dddddddd-1111-0000-0000-000000000003';
  phase_1_render    UUID := 'dddddddd-1111-0000-0000-000000000004';

  -- Phases projet 2 (Luxe Cosmetics)
  phase_2_script    UUID := 'dddddddd-2222-0000-0000-000000000001';
  phase_2_design    UUID := 'dddddddd-2222-0000-0000-000000000002';
  phase_2_animation UUID := 'dddddddd-2222-0000-0000-000000000003';
  phase_2_render    UUID := 'dddddddd-2222-0000-0000-000000000004';

  -- Phases projet 3 (EcoGreen)
  phase_3_script    UUID := 'dddddddd-3333-0000-0000-000000000001';
  phase_3_design    UUID := 'dddddddd-3333-0000-0000-000000000002';
  phase_3_animation UUID := 'dddddddd-3333-0000-0000-000000000003';
  phase_3_render    UUID := 'dddddddd-3333-0000-0000-000000000004';

BEGIN

-- ============================================
-- AUTH USERS (local dev uniquement)
-- ============================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES
  (user_super_admin, 'superadmin@mostra.io', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"full_name": "Super Admin"}'),
  (user_admin,       'admin@mostra.io',      crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"full_name": "Kylian Mansa Barré"}'),
  (user_creative_1,  'creative1@mostra.io',  crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"full_name": "Lucas Martin"}'),
  (user_creative_2,  'creative2@mostra.io',  crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"full_name": "Sofia Benali"}'),
  (user_client,      'client@techvision.io', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"full_name": "Alex Chen"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROFILES
-- ============================================

INSERT INTO profiles (id, email, full_name, contact_method)
VALUES
  (user_super_admin, 'superadmin@mostra.io', 'Super Admin',    'email'),
  (user_admin,       'admin@mostra.io',      'Kylian Mansa Barré', 'email'),
  (user_creative_1,  'creative1@mostra.io',  'Lucas Martin',   'email'),
  (user_creative_2,  'creative2@mostra.io',  'Sofia Benali',   'whatsapp'),
  (user_client,      'client@techvision.io', 'Alex Chen',      'email')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AGENCE
-- ============================================

INSERT INTO agencies (id, name, slug, primary_color)
VALUES (agency_id, 'MOSTRA Studio', 'mostra', '#EF4444')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AGENCY MEMBERS
-- ============================================

INSERT INTO agency_members (agency_id, user_id, role, accepted_at)
VALUES
  (agency_id, user_super_admin, 'super_admin',   now()),
  (agency_id, user_admin,       'agency_admin',  now()),
  (agency_id, user_creative_1,  'creative',      now()),
  (agency_id, user_creative_2,  'creative',      now()),
  (agency_id, user_client,      'client',        now())
ON CONFLICT (agency_id, user_id) DO NOTHING;

-- ============================================
-- PHASE TEMPLATES
-- ============================================

INSERT INTO phase_templates (id, agency_id, name, slug, icon, sort_order, is_default)
VALUES
  (tpl_script,    agency_id, 'Script',    'script',    'FileText',    1, true),
  (tpl_design,    agency_id, 'Design',    'design',    'Palette',     2, true),
  (tpl_animation, agency_id, 'Animation', 'animation', 'Film',        3, true),
  (tpl_render,    agency_id, 'Render',    'render',    'MonitorPlay', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROJET 1 : TechVision Brand Film 2024
-- Statut : active — progression 75% (Script + Design + Animation done, Render in review)
-- ============================================

INSERT INTO projects (id, agency_id, name, description, client_id, project_manager_id, status, progress, share_token)
VALUES (
  proj_1, agency_id,
  'TechVision Brand Film 2024',
  'Brand film institutionnel pour TechVision — 2 min 30 sec, mettant en avant l''innovation produit.',
  user_client,
  user_creative_1,
  'active',
  75,
  'share_techvision_2024'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_phases (id, project_id, phase_template_id, name, slug, sort_order, status, started_at, completed_at)
VALUES
  (phase_1_script,    proj_1, tpl_script,    'Script',    'script',    1, 'completed',  now() - interval '30 days', now() - interval '20 days'),
  (phase_1_design,    proj_1, tpl_design,    'Design',    'design',    2, 'completed',  now() - interval '20 days', now() - interval '8 days'),
  (phase_1_animation, proj_1, tpl_animation, 'Animation', 'animation', 3, 'completed',  now() - interval '8 days',  now() - interval '2 days'),
  (phase_1_render,    proj_1, tpl_render,    'Render',    'render',    4, 'in_review',  now() - interval '2 days',  NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROJET 2 : Luxe Cosmetics Product Launch
-- Statut : active — progression 50% (Script + Design done, Animation in progress)
-- ============================================

INSERT INTO projects (id, agency_id, name, description, client_id, project_manager_id, status, progress, share_token)
VALUES (
  proj_2, agency_id,
  'Luxe Cosmetics Product Launch',
  'Vidéo de lancement pour la nouvelle gamme de soins Luxe Cosmetics. 90 secondes, esthétique haut de gamme.',
  NULL,
  user_creative_2,
  'active',
  50,
  'share_luxe_cosmetics'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_phases (id, project_id, phase_template_id, name, slug, sort_order, status, started_at, completed_at)
VALUES
  (phase_2_script,    proj_2, tpl_script,    'Script',    'script',    1, 'completed',   now() - interval '25 days', now() - interval '15 days'),
  (phase_2_design,    proj_2, tpl_design,    'Design',    'design',    2, 'completed',   now() - interval '15 days', now() - interval '5 days'),
  (phase_2_animation, proj_2, tpl_animation, 'Animation', 'animation', 3, 'in_progress', now() - interval '5 days',  NULL),
  (phase_2_render,    proj_2, tpl_render,    'Render',    'render',    4, 'pending',     NULL,                       NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROJET 3 : EcoGreen Sustainability Campaign
-- Statut : active — progression 25% (Script in review)
-- ============================================

INSERT INTO projects (id, agency_id, name, description, client_id, project_manager_id, status, progress, share_token)
VALUES (
  proj_3, agency_id,
  'EcoGreen Sustainability Campaign',
  'Campagne vidéo sur la durabilité et l''engagement écologique d''EcoGreen. Série de 3 formats courts.',
  NULL,
  user_creative_1,
  'active',
  25,
  'share_ecogreen_campaign'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO project_phases (id, project_id, phase_template_id, name, slug, sort_order, status, started_at, completed_at)
VALUES
  (phase_3_script,    proj_3, tpl_script,    'Script',    'script',    1, 'in_review', now() - interval '5 days', NULL),
  (phase_3_design,    proj_3, tpl_design,    'Design',    'design',    2, 'pending',   NULL,                      NULL),
  (phase_3_animation, proj_3, tpl_animation, 'Animation', 'animation', 3, 'pending',   NULL,                      NULL),
  (phase_3_render,    proj_3, tpl_render,    'Render',    'render',    4, 'pending',   NULL,                      NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- COMMENTAIRES
-- ============================================

INSERT INTO comments (project_id, phase_id, user_id, content, is_resolved)
VALUES
  -- TechVision : commentaire client sur le render
  (proj_1, phase_1_render, user_client,
   'Le render final est excellent ! Juste une question sur le timing de la séquence à 1:45 — peut-on accélérer légèrement la transition ?',
   false),
  -- TechVision : réponse du créatif
  (proj_1, phase_1_render, user_creative_1,
   'Bien sûr, on va ajuster ça. Je reviens vers toi d''ici demain avec une version corrigée.',
   false),
  -- Luxe : commentaire interne sur l''animation
  (proj_2, phase_2_animation, user_admin,
   'Belle progression ! N''oublie pas d''intégrer les nouvelles guidelines typographiques reçues ce matin.',
   false),
  -- EcoGreen : commentaire sur le script
  (proj_3, phase_3_script, user_creative_1,
   'Script V2 uploadé. J''ai revu le 3e format pour rester sous les 30 secondes comme demandé.',
   false);

-- ============================================
-- ACTIVITY LOGS
-- ============================================

INSERT INTO activity_logs (project_id, user_id, action, details, created_at)
VALUES
  -- TechVision
  (proj_1, user_creative_1, 'phase_started',
   '{"phase": "script", "phase_name": "Script"}',
   now() - interval '30 days'),
  (proj_1, user_creative_1, 'file_uploaded',
   '{"phase": "script", "file_name": "Script_TechVision_V01.pdf", "version": 1}',
   now() - interval '28 days'),
  (proj_1, user_creative_1, 'phase_completed',
   '{"phase": "script", "phase_name": "Script"}',
   now() - interval '20 days'),
  (proj_1, user_creative_1, 'phase_started',
   '{"phase": "render", "phase_name": "Render"}',
   now() - interval '2 days'),
  (proj_1, user_creative_1, 'phase_review',
   '{"phase": "render", "phase_name": "Render"}',
   now() - interval '1 day'),

  -- Luxe Cosmetics
  (proj_2, user_creative_2, 'phase_started',
   '{"phase": "script", "phase_name": "Script"}',
   now() - interval '25 days'),
  (proj_2, user_creative_2, 'file_uploaded',
   '{"phase": "design", "file_name": "Moodboard_Luxe_V01.pdf", "version": 1}',
   now() - interval '12 days'),
  (proj_2, user_creative_2, 'phase_completed',
   '{"phase": "design", "phase_name": "Design"}',
   now() - interval '5 days'),
  (proj_2, user_creative_2, 'phase_started',
   '{"phase": "animation", "phase_name": "Animation"}',
   now() - interval '5 days'),

  -- EcoGreen
  (proj_3, user_creative_1, 'phase_started',
   '{"phase": "script", "phase_name": "Script"}',
   now() - interval '5 days'),
  (proj_3, user_creative_1, 'file_uploaded',
   '{"phase": "script", "file_name": "Script_EcoGreen_V02.pdf", "version": 2}',
   now() - interval '1 day'),
  (proj_3, user_creative_1, 'phase_review',
   '{"phase": "script", "phase_name": "Script"}',
   now() - interval '1 day'),
  (proj_3, user_admin, 'comment_added',
   '{"phase": "script", "comment_preview": "Script V2 uploadé..."}',
   now() - interval '1 day');

END $$;
