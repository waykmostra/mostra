import type { UserRole } from '@/lib/types'

// ============================================================
// Matrice de permissions MOSTRA
// 2 rôles : admin (Tarik) + client (lecture seule via lien).
// ============================================================

// ----------------------------------------------------------
// Projets
// ----------------------------------------------------------

/** Créer un projet (admin uniquement). */
export function canCreateProject(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Voir tous les projets. */
export function canViewAllProjects(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Voir ses projets assignés uniquement. */
export function canViewAssignedProjects(role: UserRole | null): boolean {
  return role !== null
}

/** Modifier un projet (nom, description, statut). */
export function canEditProject(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Supprimer un projet. */
export function canDeleteProject(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Phases
// ----------------------------------------------------------

/** Avancer une phase (passer en in_progress, in_review…). */
export function canAdvancePhase(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Envoyer une phase en review. */
export function canSendToReview(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Approuver un livrable (admin OU client). */
export function canApproveDeliverable(role: UserRole | null): boolean {
  return role === 'admin' || role === 'client'
}

// ----------------------------------------------------------
// Fichiers
// ----------------------------------------------------------

/** Uploader des fichiers sur une phase. */
export function canUploadFile(role: UserRole | null): boolean {
  return role === 'admin'
}

/** Supprimer un fichier. */
export function canDeleteFile(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Commentaires
// ----------------------------------------------------------

/** Poster un commentaire. */
export function canComment(role: UserRole | null): boolean {
  return role !== null
}

/** Résoudre / supprimer un commentaire. */
export function canModerateComment(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Clients
// ----------------------------------------------------------

/** Gérer les clients (CRUD). */
export function canManageClients(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Pipeline & templates
// ----------------------------------------------------------

/** Configurer le pipeline (phases templates). */
export function canManagePipeline(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Logs & activité
// ----------------------------------------------------------

/** Voir les logs d'activité. */
export function canViewActivityLogs(role: UserRole | null): boolean {
  return role === 'admin'
}

// ----------------------------------------------------------
// Helper : retourne les permissions d'un rôle sous forme d'objet.
// ----------------------------------------------------------

export interface Permissions {
  createProject: boolean
  viewAllProjects: boolean
  editProject: boolean
  deleteProject: boolean
  advancePhase: boolean
  sendToReview: boolean
  approveDeliverable: boolean
  uploadFile: boolean
  deleteFile: boolean
  comment: boolean
  moderateComment: boolean
  manageClients: boolean
  managePipeline: boolean
  viewActivityLogs: boolean
}

export function getPermissions(role: UserRole | null): Permissions {
  return {
    createProject: canCreateProject(role),
    viewAllProjects: canViewAllProjects(role),
    editProject: canEditProject(role),
    deleteProject: canDeleteProject(role),
    advancePhase: canAdvancePhase(role),
    sendToReview: canSendToReview(role),
    approveDeliverable: canApproveDeliverable(role),
    uploadFile: canUploadFile(role),
    deleteFile: canDeleteFile(role),
    comment: canComment(role),
    moderateComment: canModerateComment(role),
    manageClients: canManageClients(role),
    managePipeline: canManagePipeline(role),
    viewActivityLogs: canViewActivityLogs(role),
  }
}
