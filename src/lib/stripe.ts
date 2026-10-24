import 'server-only'
import Stripe from 'stripe'

/**
 * Client Stripe — serveur uniquement (`server-only` fait échouer le build si
 * ce module est importé côté navigateur). La clé secrète vient de
 * l'environnement et n'est jamais exposée ni journalisée.
 */
let client: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Paiement indisponible : STRIPE_SECRET_KEY manquante')
  if (!client) {
    client = new Stripe(key, {
      appInfo: { name: 'Mostra App' },
      maxNetworkRetries: 2,
    })
  }
  return client
}

/** URL publique de l'app, pour les retours Stripe (succès / annulation). */
export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL manquante')
  return url
}
