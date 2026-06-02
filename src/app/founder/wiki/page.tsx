import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Folder, FolderOpen, FileText, Palette, Clapperboard, Music, Film, type LucideIcon } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Wiki — MOSTRA',
  description: 'Arborescence des projets & méthodologie de production Mostra.',
}

// ── Arborescence projet (statique) ──────────────────────────────────────────

interface TreeNode {
  name: string
  hint?: string
  children?: TreeNode[]
}

const TREE: TreeNode = {
  name: 'Mostra',
  children: [
    {
      name: 'Clients',
      children: [
        {
          name: '"NOM_CLIENT"',
          hint: 'un dossier par client',
          children: [
            {
              name: '01_Production',
              children: [
                { name: 'Script' },
                { name: 'Design' },
                { name: 'Animation' },
                { name: 'SoundDesign' },
              ],
            },
            {
              name: '02_Ressources',
              children: [
                { name: 'Images' },
                { name: 'Videos' },
                { name: 'Audio' },
                { name: 'Fonts' },
                { name: 'AE_Assets' },
              ],
            },
            {
              name: '03_Renders',
              children: [{ name: 'PreRenders' }, { name: 'Renders' }],
            },
          ],
        },
      ],
    },
  ],
}

function Tree({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const isFolder = !!node.children?.length
  const isRoot = depth === 0
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: `${depth * 18}px` }}
      >
        {isFolder ? (
          isRoot ? (
            <FolderOpen className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-[#A78BFA] flex-shrink-0" />
          )
        ) : (
          <span className="w-4 flex-shrink-0 flex justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#333333]" />
          </span>
        )}
        <span className={`text-sm ${isFolder ? 'font-medium text-white' : 'text-[#aaaaaa]'}`}>
          {node.name}
        </span>
        {node.hint && <span className="text-[10px] text-[#555555] italic">— {node.hint}</span>}
      </div>
      {node.children?.map((child) => (
        <Tree key={child.name} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ── Méthodologie de production (statique) ───────────────────────────────────

interface Phase {
  name: string
  icon: LucideIcon
  color: string
  tools: string[]
  points: string[]
}

const PHASES: Phase[] = [
  {
    name: 'Script',
    icon: FileText,
    color: '#3B82F6',
    tools: ['Notion', 'Google Docs'],
    points: [
      'Structure : HOOK → PAIN POINTS → SOLUTION → FEATURES → CTA',
      'Calibrer la durée : ~120 mots par minute',
      'Valider le script avant de lancer le design',
    ],
  },
  {
    name: 'Design',
    icon: Palette,
    color: '#A78BFA',
    tools: ['Moodboard', 'Illustrator', 'Figma'],
    points: [
      'Démarrer par un moodboard (références, direction artistique)',
      'Créer les assets dans Illustrator / Figma',
      "Préparer des calques propres et nommés pour l'animation",
    ],
  },
  {
    name: 'Animation',
    icon: Clapperboard,
    color: '#00D76B',
    tools: ['After Effects', 'Cinema 4D'],
    points: [
      'Animer dans After Effects (+ C4D pour la 3D)',
      'Partir du template Mostra pour la cohérence',
      'Respecter le timing défini par le script',
    ],
  },
  {
    name: 'Sound Design',
    icon: Music,
    color: '#F59E0B',
    tools: ['Audio'],
    points: [
      "Musique + SFX synchronisés sur l'animation",
      'Mixer proprement (niveaux, transitions, respirations)',
    ],
  },
  {
    name: 'Rendu',
    icon: Film,
    color: '#22C55E',
    tools: ['Export'],
    points: [
      'Pré-rendus dans 03_Renders/PreRenders pour validation',
      'Rendu final exporté dans 03_Renders/Renders',
    ],
  },
]

export default async function WikiPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Wiki production</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          Arborescence standard des projets & méthodologie par phase.
        </p>
      </div>

      {/* Arborescence */}
      <section className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Arborescence projet</h2>
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 overflow-x-auto">
          <Tree node={TREE} />
        </div>
        <p className="text-xs text-[#555555] mt-3 leading-relaxed">
          Même structure pour chaque client. <span className="text-[#777777]">01_Production</span> pour le travail
          en cours, <span className="text-[#777777]">02_Ressources</span> pour les assets sources,{' '}
          <span className="text-[#777777]">03_Renders</span> pour les exports.
        </p>
      </section>

      {/* Méthodologie */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white px-1">Méthodologie par phase</h2>
        {PHASES.map((phase) => (
          <div key={phase.name} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${phase.color}1a` }}
                >
                  <phase.icon className="h-4 w-4" style={{ color: phase.color }} />
                </span>
                <h3 className="text-sm font-semibold text-white">{phase.name}</h3>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {phase.tools.map((tool) => (
                  <span
                    key={tool}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#262626] text-[#888888]"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <ul className="space-y-1.5">
              {phase.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#aaaaaa] leading-relaxed">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: phase.color }}
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
