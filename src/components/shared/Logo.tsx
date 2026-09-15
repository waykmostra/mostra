import Image from 'next/image'

interface LogoProps {
  /** "icon" = symbole seul, "full" = logo complet */
  variant?: 'icon' | 'full'
  /**
   * "theme" (défaut) = noir en mode jour, blanc en mode nuit.
   * "white" / "green" = forcé (à réserver aux fonds fixes, ex. média sombre).
   */
  color?: 'theme' | 'white' | 'green'
  /** Hauteur CSS Tailwind (ex: "h-8", "h-10"). Largeur auto. */
  className?: string
}

const SOURCES: Record<string, string> = {
  'icon-white': '/logos/Icon_white.svg',
  'full-white': '/logos/Mostra_White.svg',
  'full-green': '/logos/Mostra_vert.svg',
}

// Dimensions intrinsèques (utilisées par next/image pour le calcul layout)
const DIMENSIONS: Record<string, { width: number; height: number }> = {
  'icon-white': { width: 32, height: 32 },
  'full-white': { width: 140, height: 32 },
  'full-green': { width: 140, height: 32 },
}

export default function Logo({
  variant = 'full',
  color = 'theme',
  className = 'h-8',
}: LogoProps) {
  // En mode "theme" on part du SVG blanc et on le teinte en CSS :
  //   brightness-0        → noir plein (mode jour)
  //   dark:invert (+ le brightness-0 ci-dessus) → blanc plein (mode nuit)
  const themed = color === 'theme'
  const key = variant === 'icon' ? 'icon-white' : `full-${themed ? 'white' : color}`
  const { width, height } = DIMENSIONS[key]

  return (
    <Image
      src={SOURCES[key]}
      alt="MOSTRA"
      width={width}
      height={height}
      className={`w-auto ${themed ? 'brightness-0 dark:invert' : ''} ${className}`}
      unoptimized
      priority
    />
  )
}
