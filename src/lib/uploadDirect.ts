/**
 * Upload direct navigateur → Supabase Storage via une URL signée.
 *
 * Vercel refuse tout corps de requête au-delà de 4,5 Mo : un fichier envoyé
 * dans une Server Action échoue en prod (l'action ne renvoie rien). Le flux
 * fiable, déjà utilisé par la revue vidéo, se fait en trois temps :
 *   1. une action serveur légère crée l'URL d'upload signée ;
 *   2. le navigateur envoie le fichier directement à Supabase (ici) ;
 *   3. une action serveur légère enregistre le fichier en base.
 */
export function putToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Erreur serveur ${xhr.status} : ${xhr.responseText}`))
    }
    xhr.onerror = () => reject(new Error('Erreur réseau — vérifiez votre connexion'))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream')
    xhr.send(file)
  })
}
