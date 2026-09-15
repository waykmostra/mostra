'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import { updateProfile } from './actions'

interface ProfileSectionProps {
  name: string
  email: string
  avatarUrl: string | null
}

export default function ProfileSection({ name, email, avatarUrl }: ProfileSectionProps) {
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo")
      e.target.value = ''
      return
    }
    setPreview(URL.createObjectURL(file))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.success) toast.success(result.message)
      else toast.error(result.error)
    })
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Profil</h2>
        <p className="text-xs text-faint mt-0.5">Nom affiché et photo de profil</p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-surface-2 border border-line flex items-center justify-center overflow-hidden flex-shrink-0">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-faint">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center hover:bg-brand transition-colors"
              aria-label="Changer l'avatar"
            >
              <Camera className="h-3 w-3 text-black" />
            </button>
          </div>

          <div>
            <p className="text-xs text-dim">Photo de profil</p>
            <p className="text-[11px] text-faint mt-0.5">JPG, PNG · max 2 Mo</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 text-[11px] text-brand hover:text-brand transition-colors"
            >
              Changer la photo
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-dim mb-1.5">
            Nom complet
          </label>
          <input
            name="name"
            type="text"
            defaultValue={name}
            required
            placeholder="Prénom Nom"
            className="w-full px-3 py-2.5 bg-canvas border border-line rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
        </div>

        {/* Email — read-only */}
        <div>
          <label className="block text-xs font-medium text-dim mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-3 py-2.5 bg-canvas border border-line rounded-lg text-sm text-faint cursor-not-allowed"
          />
          <p className="text-[11px] text-faint mt-1">
            L&apos;email ne peut pas être modifié
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-black text-sm font-semibold hover:bg-brand disabled:opacity-50 transition-colors"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Sauvegarder le profil
        </button>
      </form>
    </section>
  )
}
