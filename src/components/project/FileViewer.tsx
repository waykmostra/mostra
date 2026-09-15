'use client'

import { useRouter } from 'next/navigation'
import { Download, FileX, ChevronDown, User, HardDrive, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { getSignedUrl } from '@/app/projects/file-actions'
import { formatFileSize } from '@/lib/utils/files'
import { formatDate } from '@/lib/utils/dates'
import type { PhaseFile } from '@/lib/types'

// ── Détection du type de fichier ──────────────────────────────────

function fileCategory(file: PhaseFile): 'pdf' | 'video' | 'image' | 'other' {
  const mime = file.file_type ?? ''
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  // Fallback par extension
  const ext = file.file_name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'mov', 'avi'].includes(ext ?? '')) return 'video'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return 'image'
  return 'other'
}

// ── Props ─────────────────────────────────────────────────────────

interface FileViewerProps {
  /** Fichiers de la phase (triés par version décroissante) */
  files: PhaseFile[]
  /** Version actuellement affichée */
  activeVersion: number
  /** URL signée (1 h) pour la version active, générée côté serveur */
  signedUrl: string
  /** Pour construire l'URL de changement de version */
  viewPath: string
  /** Noms des uploadeurs keyed by user_id */
  uploaders: Record<string, string>
  /**
   * Fonction pour générer une URL signée fraîche (download).
   * Par défaut : getSignedUrl (requiert une session auth).
   * Passer getClientSignedUrl pour l'espace client public.
   */
  getSignedUrlFn?: (filePath: string) => Promise<{ url: string } | { error: string }>
}

// ── Composant principal ───────────────────────────────────────────

export default function FileViewer({
  files,
  activeVersion,
  signedUrl,
  viewPath,
  uploaders,
  getSignedUrlFn = getSignedUrl,
}: FileViewerProps) {
  const router = useRouter()

  const activeFile = files.find((f) => f.version === activeVersion) ?? files[0]
  const category = fileCategory(activeFile)

  function changeVersion(v: number) {
    router.push(`${viewPath}?v=${v}`)
  }

  async function handleDownload() {
    const result = await getSignedUrlFn(activeFile.file_url)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    const a = document.createElement('a')
    a.href = result.url
    a.download = activeFile.file_name
    a.click()
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
      {/* ── Zone principale ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Barre d'outils */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sélecteur de version */}
          <div className="relative inline-flex items-center">
            <select
              value={activeVersion}
              onChange={(e) => changeVersion(Number(e.target.value))}
              className="
                appearance-none bg-surface-2 border border-line rounded-lg
                pl-3 pr-7 py-1.5 text-xs text-ink
                hover:border-line-strong focus:outline-none focus:border-brand/50
                cursor-pointer
              "
            >
              {files.map((f) => (
                <option key={f.id} value={f.version}>
                  v{f.version}
                  {f.is_current ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 h-3 w-3 text-faint pointer-events-none" />
          </div>

          <span className="text-xs text-faint truncate max-w-xs">{activeFile.file_name}</span>

          <button
            type="button"
            onClick={handleDownload}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-dim hover:text-ink hover:border-line-strong transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Télécharger
          </button>
        </div>

        {/* Visionneuse */}
        <div
          className="flex-1 bg-surface border border-line rounded-xl overflow-hidden"
          style={{ minHeight: '480px' }}
        >
          <FilePreview
            category={category}
            signedUrl={signedUrl}
            file={activeFile}
            onDownload={handleDownload}
          />
        </div>
      </div>

      {/* ── Sidebar droite ────────────────────────────────────────── */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
        {/* Infos fichier actif */}
        <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-semibold text-faint uppercase tracking-widest">
            Fichier
          </p>

          <div className="space-y-2">
            <InfoRow icon={<HardDrive className="h-3.5 w-3.5" />}>
              {activeFile.file_size ? formatFileSize(activeFile.file_size) : '—'}
            </InfoRow>
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />}>
              {formatDate(activeFile.created_at)}
            </InfoRow>
            <InfoRow icon={<User className="h-3.5 w-3.5" />}>
              {uploaders[activeFile.uploaded_by] ?? 'Inconnu'}
            </InfoRow>
          </div>
        </div>

        {/* Historique des versions */}
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-3">
            Versions
          </p>
          <div className="space-y-1.5">
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => changeVersion(f.version)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg border transition-colors
                  ${
                    f.version === activeVersion
                      ? 'bg-surface-2 border-brand/30 text-ink'
                      : 'border-line text-faint hover:text-ink hover:border-line'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">v{f.version}</span>
                  {f.is_current && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-faint mt-0.5 truncate">{f.file_name}</p>
                <p className="text-[10px] text-faint">{formatDate(f.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Visionneuse selon le type ─────────────────────────────────────

function FilePreview({
  category,
  signedUrl,
  file,
  onDownload,
}: {
  category: 'pdf' | 'video' | 'image' | 'other'
  signedUrl: string
  file: PhaseFile
  onDownload: () => void
}) {
  if (category === 'pdf') {
    return (
      <iframe
        src={signedUrl}
        className="w-full h-full"
        style={{ minHeight: '480px' }}
        title={file.file_name}
      />
    )
  }

  if (category === 'video') {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          key={signedUrl}
          controls
          className="max-w-full max-h-full rounded-lg"
          style={{ maxHeight: '560px' }}
        >
          <source src={signedUrl} type={file.file_type ?? undefined} />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      </div>
    )
  }

  if (category === 'image') {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={signedUrl}
          src={signedUrl}
          alt={file.file_name}
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ maxHeight: '560px' }}
        />
      </div>
    )
  }

  // Autre format
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-8">
      <FileX className="h-12 w-12 text-faint" />
      <div>
        <p className="text-sm text-faint">Aperçu non disponible</p>
        <p className="text-xs text-faint mt-1">{file.file_name}</p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand/10 border border-brand/20 text-sm text-brand hover:bg-brand/20 transition-colors"
      >
        <Download className="h-4 w-4" />
        Télécharger
      </button>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-faint">
      <span className="text-faint flex-shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  )
}
