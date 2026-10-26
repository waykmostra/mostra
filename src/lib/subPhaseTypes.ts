// Types de sous-étape proposés dans l'éditeur d'étape. Le `slug` aiguille
// l'interface rendue côté admin et côté client (formulaire, script, moodboard…).
//
// Hors de `sub-phase-actions.ts` exprès : un fichier « use server » ne peut
// exporter que des fonctions async. Une constante exportée là fait échouer
// tout le module, donc toutes les actions de sous-étape (démarrer, review…).

export type SubPhaseType =
  | 'formulaire'
  | 'script'
  | 'style'
  | 'storyboard'
  | 'design'
  | 'vo'
  | 'musique'

export const SUB_PHASE_TYPES: { type: SubPhaseType; slug: string; name: string }[] = [
  { type: 'formulaire', slug: 'formulaire', name: 'Formulaire de brief' },
  { type: 'script', slug: 'script', name: 'Script' },
  { type: 'style', slug: 'style', name: 'Moodboard / Style' },
  { type: 'storyboard', slug: 'storyboard', name: 'Storyboard' },
  { type: 'design', slug: 'design', name: 'Maquettes' },
  { type: 'vo', slug: 'vo', name: 'Voix off' },
  { type: 'musique', slug: 'musique', name: 'Musique' },
]
