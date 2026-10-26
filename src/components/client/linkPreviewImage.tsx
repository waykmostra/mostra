import { ImageResponse } from 'next/og'
import { PHASE_STATUS_LABEL, type LinkPreview } from '@/lib/linkPreview'

export const LINK_PREVIEW_SIZE = { width: 1200, height: 630 }

/**
 * Carte d'aperçu 1200×630 d'un lien client : fond noir Mostra, wordmark,
 * nom du projet, étape et statut, barre d'avancement verte. Formes pleines
 * et texte uniquement, pour rester bien sous les 300 Ko qu'accepte WhatsApp.
 */
export function linkPreviewImage(preview: LinkPreview | null): ImageResponse {
  const name = preview?.projectName ?? 'Espace client'
  const phase = preview?.phase
  const progress = preview?.progress ?? 0
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: '#020302', color: '#ffffff', padding: '72px 80px', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: '#00D96B' }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>MOSTRA</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: name.length > 28 ? 64 : 80, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          {phase && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, color: '#b8b8b8' }}>
              <span>{phase.name}</span>
              <span style={{ color: '#555' }}>·</span>
              <span style={{ color: phase.status === 'in_review' ? '#00D96B' : '#b8b8b8' }}>{PHASE_STATUS_LABEL[phase.status]}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#8a8a8a' }}>
            <span>Avancement</span>
            <span>{progress} %</span>
          </div>
          <div style={{ display: 'flex', width: '100%', height: 12, borderRadius: 999, background: '#1c1f1c' }}>
            <div style={{ width: `${Math.max(2, progress)}%`, height: 12, borderRadius: 999, background: '#00D96B' }} />
          </div>
        </div>
      </div>
    ),
    LINK_PREVIEW_SIZE,
  )
}
