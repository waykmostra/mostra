/**
 * MOSTRA — Script de seed (données de démo)
 * Usage : npm run seed
 *
 * Crée 5 utilisateurs via l'API admin Supabase, puis insère
 * les données de démo (agence, membres, projets, phases...).
 *
 * Prérequis : les migrations 001 et 002 doivent être appliquées.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Variables d\'environnement manquantes. Assurez-vous que .env.local est configuré.')
  process.exit(1)
}

const supabase = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// UUIDs fixes pour la reproductibilité
const AGENCY_ID   = '11111111-1111-1111-1111-111111111111'
const USER_SUPER  = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER_ADMIN  = 'aaaaaaaa-0000-0000-0000-000000000002'
const USER_CREA_1 = 'aaaaaaaa-0000-0000-0000-000000000003'
const USER_CREA_2 = 'aaaaaaaa-0000-0000-0000-000000000004'
const USER_CLIENT = 'aaaaaaaa-0000-0000-0000-000000000005'

const TPL_SCRIPT    = 'bbbbbbbb-0000-0000-0000-000000000001'
const TPL_DESIGN    = 'bbbbbbbb-0000-0000-0000-000000000002'
const TPL_ANIMATION = 'bbbbbbbb-0000-0000-0000-000000000003'
const TPL_RENDER    = 'bbbbbbbb-0000-0000-0000-000000000004'

const PROJ_1 = 'cccccccc-0000-0000-0000-000000000001'
const PROJ_2 = 'cccccccc-0000-0000-0000-000000000002'
const PROJ_3 = 'cccccccc-0000-0000-0000-000000000003'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000).toISOString()
}

async function createUser(id: string, email: string, fullName: string, password = 'Test1234!') {
  const { data, error } = await supabase.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error && !error.message.includes('already been registered')) {
    throw new Error(`createUser(${email}): ${error.message}`)
  }
  return data?.user
}

async function run() {
  console.log('🌱  MOSTRA seed — démarrage...\n')

  // ── 1. Utilisateurs ────────────────────────────────────────────
  console.log('👤  Création des utilisateurs...')
  await createUser(USER_SUPER,  'superadmin@mostra.io',  'Super Admin')
  await createUser(USER_ADMIN,  'admin@mostra.io',       'Kylian Mansa Barré')
  await createUser(USER_CREA_1, 'creative1@mostra.io',   'Lucas Martin')
  await createUser(USER_CREA_2, 'creative2@mostra.io',   'Sofia Benali')
  await createUser(USER_CLIENT, 'client@techvision.io',  'Alex Chen')
  console.log('   ✓ 5 utilisateurs créés (mot de passe : Test1234!)\n')

  // ── 2. Profils ────────────────────────────────────────────────
  // Le trigger handle_new_user crée les profils automatiquement lors
  // d'un INSERT dans auth.users. Mais si les users ont été créés avant
  // que les migrations soient appliquées, le trigger ne les a pas vus.
  // On fait donc un upsert explicite pour garantir leur existence.
  console.log('📝  Upsert des profils...')
  const { error: profilesErr } = await supabase.from('profiles').upsert([
    { id: USER_SUPER,  email: 'superadmin@mostra.io', full_name: 'Super Admin',    contact_method: 'email' },
    { id: USER_ADMIN,  email: 'admin@mostra.io',      full_name: 'Kylian Mansa Barré', contact_method: 'email' },
    { id: USER_CREA_1, email: 'creative1@mostra.io',  full_name: 'Lucas Martin',   contact_method: 'email' },
    { id: USER_CREA_2, email: 'creative2@mostra.io',  full_name: 'Sofia Benali',   contact_method: 'whatsapp' },
    { id: USER_CLIENT, email: 'client@techvision.io', full_name: 'Alex Chen',      contact_method: 'email' },
  ], { onConflict: 'id' })
  if (profilesErr) throw new Error(`Profiles: ${profilesErr.message}`)
  console.log('   ✓ 5 profils créés/mis à jour\n')

  // ── 3. Agence ──────────────────────────────────────────────────
  console.log('🏢  Création de l\'agence...')
  const { error: agencyErr } = await supabase.from('agencies').upsert({
    id: AGENCY_ID,
    name: 'MOSTRA Studio',
    slug: 'mostra',
    primary_color: '#EF4444',
  }, { onConflict: 'id' })
  if (agencyErr) throw new Error(`Agency: ${agencyErr.message}`)
  console.log('   ✓ MOSTRA Studio créée\n')

  // ── 4. Membres ─────────────────────────────────────────────────
  console.log('👥  Ajout des membres...')
  const { error: membersErr } = await supabase.from('agency_members').upsert([
    { agency_id: AGENCY_ID, user_id: USER_SUPER,  role: 'super_admin',  accepted_at: daysAgo(60) },
    { agency_id: AGENCY_ID, user_id: USER_ADMIN,  role: 'agency_admin', accepted_at: daysAgo(60) },
    { agency_id: AGENCY_ID, user_id: USER_CREA_1, role: 'creative',     accepted_at: daysAgo(45) },
    { agency_id: AGENCY_ID, user_id: USER_CREA_2, role: 'creative',     accepted_at: daysAgo(30) },
    { agency_id: AGENCY_ID, user_id: USER_CLIENT, role: 'client',       accepted_at: daysAgo(30) },
  ], { onConflict: 'agency_id,user_id' })
  if (membersErr) throw new Error(`Members: ${membersErr.message}`)
  console.log('   ✓ 5 membres ajoutés\n')

  // ── 5. Phase templates ─────────────────────────────────────────
  console.log('📋  Création des phase templates...')
  const { error: tplErr } = await supabase.from('phase_templates').upsert([
    { id: TPL_SCRIPT,    agency_id: AGENCY_ID, name: 'Script',    slug: 'script',    icon: 'FileText',    sort_order: 1 },
    { id: TPL_DESIGN,    agency_id: AGENCY_ID, name: 'Design',    slug: 'design',    icon: 'Palette',     sort_order: 2 },
    { id: TPL_ANIMATION, agency_id: AGENCY_ID, name: 'Animation', slug: 'animation', icon: 'Film',        sort_order: 3 },
    { id: TPL_RENDER,    agency_id: AGENCY_ID, name: 'Render',    slug: 'render',    icon: 'MonitorPlay', sort_order: 4 },
  ], { onConflict: 'id' })
  if (tplErr) throw new Error(`Templates: ${tplErr.message}`)
  console.log('   ✓ 4 templates créés\n')

  // ── 6. Projets ─────────────────────────────────────────────────
  console.log('🎬  Création des projets...')
  const { error: projErr } = await supabase.from('projects').upsert([
    {
      id: PROJ_1,
      agency_id: AGENCY_ID,
      name: 'TechVision Brand Film 2024',
      description: 'Brand film institutionnel pour TechVision — 2 min 30 sec.',
      client_id: USER_CLIENT,
      project_manager_id: USER_CREA_1,
      status: 'active',
      progress: 75,
      share_token: 'share_techvision_2024',
    },
    {
      id: PROJ_2,
      agency_id: AGENCY_ID,
      name: 'Luxe Cosmetics Product Launch',
      description: 'Vidéo de lancement pour la nouvelle gamme Luxe Cosmetics. 90 sec.',
      client_id: USER_CLIENT,
      project_manager_id: USER_CREA_2,
      status: 'active',
      progress: 50,
      share_token: 'share_luxe_cosmetics',
    },
    {
      id: PROJ_3,
      agency_id: AGENCY_ID,
      name: 'EcoGreen Sustainability Campaign',
      description: 'Campagne vidéo durabilité EcoGreen. Série de 3 formats courts.',
      client_id: USER_CLIENT,
      project_manager_id: USER_CREA_1,
      status: 'active',
      progress: 25,
      share_token: 'share_ecogreen_campaign',
    },
  ], { onConflict: 'id' })
  if (projErr) throw new Error(`Projects: ${projErr.message}`)
  console.log('   ✓ 3 projets créés\n')

  // ── 7. Phases ──────────────────────────────────────────────────
  console.log('⏱   Création des phases...')
  const { error: phasesErr } = await supabase.from('project_phases').upsert([
    // Projet 1 : TechVision (75% — render in_review)
    { id: 'dddddddd-1111-0000-0000-000000000001', project_id: PROJ_1, phase_template_id: TPL_SCRIPT,    name: 'Script',    slug: 'script',    sort_order: 1, status: 'completed',  started_at: daysAgo(30), completed_at: daysAgo(20) },
    { id: 'dddddddd-1111-0000-0000-000000000002', project_id: PROJ_1, phase_template_id: TPL_DESIGN,    name: 'Design',    slug: 'design',    sort_order: 2, status: 'completed',  started_at: daysAgo(20), completed_at: daysAgo(8) },
    { id: 'dddddddd-1111-0000-0000-000000000003', project_id: PROJ_1, phase_template_id: TPL_ANIMATION, name: 'Animation', slug: 'animation', sort_order: 3, status: 'completed',  started_at: daysAgo(8),  completed_at: daysAgo(2) },
    { id: 'dddddddd-1111-0000-0000-000000000004', project_id: PROJ_1, phase_template_id: TPL_RENDER,    name: 'Render',    slug: 'render',    sort_order: 4, status: 'in_review',  started_at: daysAgo(2),  completed_at: null },
    // Projet 2 : Luxe (50% — animation in_progress)
    { id: 'dddddddd-2222-0000-0000-000000000001', project_id: PROJ_2, phase_template_id: TPL_SCRIPT,    name: 'Script',    slug: 'script',    sort_order: 1, status: 'completed',  started_at: daysAgo(25), completed_at: daysAgo(15) },
    { id: 'dddddddd-2222-0000-0000-000000000002', project_id: PROJ_2, phase_template_id: TPL_DESIGN,    name: 'Design',    slug: 'design',    sort_order: 2, status: 'completed',  started_at: daysAgo(15), completed_at: daysAgo(5) },
    { id: 'dddddddd-2222-0000-0000-000000000003', project_id: PROJ_2, phase_template_id: TPL_ANIMATION, name: 'Animation', slug: 'animation', sort_order: 3, status: 'in_progress', started_at: daysAgo(5),  completed_at: null },
    { id: 'dddddddd-2222-0000-0000-000000000004', project_id: PROJ_2, phase_template_id: TPL_RENDER,    name: 'Render',    slug: 'render',    sort_order: 4, status: 'pending',    started_at: null,        completed_at: null },
    // Projet 3 : EcoGreen (25% — script in_review)
    { id: 'dddddddd-3333-0000-0000-000000000001', project_id: PROJ_3, phase_template_id: TPL_SCRIPT,    name: 'Script',    slug: 'script',    sort_order: 1, status: 'in_review',  started_at: daysAgo(5),  completed_at: null },
    { id: 'dddddddd-3333-0000-0000-000000000002', project_id: PROJ_3, phase_template_id: TPL_DESIGN,    name: 'Design',    slug: 'design',    sort_order: 2, status: 'pending',    started_at: null,        completed_at: null },
    { id: 'dddddddd-3333-0000-0000-000000000003', project_id: PROJ_3, phase_template_id: TPL_ANIMATION, name: 'Animation', slug: 'animation', sort_order: 3, status: 'pending',    started_at: null,        completed_at: null },
    { id: 'dddddddd-3333-0000-0000-000000000004', project_id: PROJ_3, phase_template_id: TPL_RENDER,    name: 'Render',    slug: 'render',    sort_order: 4, status: 'pending',    started_at: null,        completed_at: null },
  ], { onConflict: 'id' })
  if (phasesErr) throw new Error(`Phases: ${phasesErr.message}`)
  console.log('   ✓ 12 phases créées\n')

  // ── 8. Commentaires ────────────────────────────────────────────
  console.log('💬  Ajout des commentaires...')
  const { error: commErr } = await supabase.from('comments').upsert([
    {
      project_id: PROJ_1,
      phase_id: 'dddddddd-1111-0000-0000-000000000004',
      user_id: USER_CLIENT,
      content: 'Le render est excellent ! Question sur le timing à 1:45 — peut-on accélérer la transition ?',
      is_resolved: false,
    },
    {
      project_id: PROJ_1,
      phase_id: 'dddddddd-1111-0000-0000-000000000004',
      user_id: USER_CREA_1,
      content: 'Bien sûr, je reviens vers toi demain avec une version corrigée.',
      is_resolved: false,
    },
    {
      project_id: PROJ_2,
      phase_id: 'dddddddd-2222-0000-0000-000000000003',
      user_id: USER_ADMIN,
      content: 'Belle progression ! N\'oublie pas les nouvelles guidelines typo reçues ce matin.',
      is_resolved: false,
    },
    {
      project_id: PROJ_3,
      phase_id: 'dddddddd-3333-0000-0000-000000000001',
      user_id: USER_CREA_1,
      content: 'Script V2 uploadé. J\'ai revu le 3e format pour rester sous les 30 secondes.',
      is_resolved: false,
    },
  ])
  if (commErr) throw new Error(`Comments: ${commErr.message}`)
  console.log('   ✓ 4 commentaires ajoutés\n')

  console.log('✅  Seed terminé avec succès !\n')
  console.log('Comptes de démo :')
  console.log('  superadmin@mostra.io   — super_admin   (Test1234!)')
  console.log('  admin@mostra.io        — agency_admin  (Test1234!)')
  console.log('  creative1@mostra.io    — creative      (Test1234!)')
  console.log('  creative2@mostra.io    — creative      (Test1234!)')
  console.log('  client@techvision.io   — client        (Test1234!)')
}

run().catch((err) => {
  console.error('\n❌ Erreur :', err.message)
  process.exit(1)
})
