'use client'

import { useRef, useState } from 'react'
import { Film, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { VideoFile } from '@/app/projects/video-actions'
import { createVideoUploadUrl, recordVideoUpload } from '@/app/projects/video-actions'

// Envoi d'une vidéo (admin) : URL signée, upload direct vers Supabase Storage,
// puis enregistrement des métadonnées. Extrait tel quel de l'ancien lecteur admin.

interface UploadZoneProps {
  phaseId: string
  projectId: string
  onUploaded: (file: VideoFile) => void
  isNewVersion?: boolean
}

export default function VideoUploadZone({ phaseId, projectId, onUploaded, isNewVersion = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setIsUploading(true)
    setProgress('Préparation…')

    // Déterminer le MIME canonique depuis l'extension
    const VIDEO_MIME: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime',
      webm: 'video/webm', avi: 'video/x-msvideo',
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = VIDEO_MIME[ext] ?? file.type ?? 'video/mp4'

    // Avertissement compat : MOV/AVI ne se lisent pas sur tous les appareils (Android).
    if (ext === 'mov' || ext === 'avi') {
      toast.warning('Astuce : le MP4 (H.264) se lit partout. Le .MOV/.AVI peut ne pas s’ouvrir sur Android.')
    }

    // ── Étape 1 : obtenir la signed upload URL (Server Action légère, pas de fichier) ──
    const urlResult = await createVideoUploadUrl({
      phaseId, projectId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    })

    if (!urlResult.success) {
      setIsUploading(false)
      setProgress(null)
      toast.error(urlResult.error)
      return
    }

    // ── Étape 2 : upload direct navigateur → Supabase Storage (bypass Vercel) ──
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setProgress(`Upload ${pct}%`)
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Erreur serveur ${xhr.status} : ${xhr.responseText}`))
        }
        xhr.onerror = () => reject(new Error('Erreur réseau — vérifiez votre connexion'))
        xhr.open('PUT', urlResult.uploadUrl)
        xhr.setRequestHeader('Content-Type', mimeType)
        xhr.send(file)
      })
    } catch (err) {
      setIsUploading(false)
      setProgress(null)
      toast.error(err instanceof Error ? err.message : 'Upload échoué')
      return
    }

    // ── Étape 3 : enregistrer les métadonnées en base (Server Action légère) ──
    setProgress('Enregistrement…')
    const recordResult = await recordVideoUpload({
      phaseId, projectId,
      storagePath: urlResult.storagePath,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      version: urlResult.version,
    })

    setIsUploading(false)
    setProgress(null)

    if (recordResult.success) {
      toast.success('Vidéo uploadée avec succès')
      onUploaded(recordResult.file)
    } else {
      toast.error(recordResult.error)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (isNewVersion) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.webm,.avi,video/mp4,video/quicktime,video/webm,video/x-msvideo"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-surface-2 border border-line text-dim
            hover:border-line-strong hover:text-ink transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isUploading ? 'Envoi…' : 'Nouvelle version'}
        </button>
      </>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={`
        flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12
        transition-colors
        ${isDragOver ? 'border-white/40 bg-white/5' : 'border-line bg-surface'}
      `}
    >
      <Film className="h-12 w-12 text-faint" />
      <div className="text-center">
        <p className="text-sm font-medium text-faint">
          Glissez une vidéo ici ou{' '}
          <label className="text-ink cursor-pointer hover:underline">
            choisissez un fichier
            <input
              type="file"
              accept=".mp4,.mov,.webm,.avi,video/mp4,video/quicktime,video/webm,video/x-msvideo"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </label>
        </p>
        <p className="text-xs text-faint mt-1">MP4, MOV, WebM — max 500 MB</p>
      </div>
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-faint">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      )}
    </div>
  )
}
