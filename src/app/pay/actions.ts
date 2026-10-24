'use server'

import { createCheckoutForRequest } from '@/lib/payments'

/**
 * Lance le paiement d'une demande. Public : le jeton du lien EST l'accès
 * (comme le share_token du portail). Le navigateur n'envoie que ce jeton ; le
 * montant et le libellé sont relus en base côté serveur.
 */
export async function startCheckout(
  payToken: string,
  returnTo: 'portal' | 'link',
): Promise<{ url: string } | { error: string }> {
  if (typeof payToken !== 'string' || (returnTo !== 'portal' && returnTo !== 'link')) {
    return { error: 'Requête invalide.' }
  }
  try {
    return await createCheckoutForRequest(payToken, returnTo)
  } catch (err) {
    console.error('[startCheckout]', err instanceof Error ? err.message : err)
    return { error: 'Le paiement est momentanément indisponible. Réessayez dans un instant.' }
  }
}
