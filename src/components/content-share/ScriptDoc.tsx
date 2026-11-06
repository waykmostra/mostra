import type { CSSProperties, ReactNode } from 'react'
import type { DocNode } from '@/lib/content-share'

// Rendu en lecture seule du document TipTap d'un contenu du Compagnon.
// Aucun HTML n'est injecté : chaque nœud connu devient un élément React, les
// couleurs et tailles sont filtrées, les liens limités à http(s) et mailto.

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|var\(--[a-z0-9-]+\))$/i
const SIZE_RE = /^\d{1,3}(\.\d+)?(px|em|rem|%)$/
const HREF_RE = /^(https?:|mailto:)/i

const safeColor = (v: unknown) => (typeof v === 'string' && COLOR_RE.test(v.trim()) ? v.trim() : undefined)
const safeSize = (v: unknown) => (typeof v === 'string' && SIZE_RE.test(v.trim()) ? v.trim() : undefined)

function renderText(node: DocNode, key: number): ReactNode {
  let out: ReactNode = node.text || ''
  for (const mark of node.marks || []) {
    const a = mark.attrs || {}
    switch (mark.type) {
      case 'bold': out = <strong>{out}</strong>; break
      case 'italic': out = <em>{out}</em>; break
      case 'underline': out = <u>{out}</u>; break
      case 'strike': out = <s>{out}</s>; break
      case 'code': out = <code>{out}</code>; break
      case 'highlight': {
        const bg = safeColor(a.color)
        out = <mark style={bg ? { background: bg } : undefined}>{out}</mark>
        break
      }
      case 'textStyle': {
        const style: CSSProperties = { color: safeColor(a.color), fontSize: safeSize(a.fontSize) }
        if (style.color || style.fontSize) out = <span style={style}>{out}</span>
        break
      }
      case 'link': {
        const href = typeof a.href === 'string' && HREF_RE.test(a.href) ? a.href : null
        if (href) out = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{out}</a>
        break
      }
    }
  }
  return <span key={key}>{out}</span>
}

function children(node: DocNode): ReactNode {
  return (node.content || []).map((c, i) => renderNode(c, i))
}

function renderNode(node: DocNode, key: number): ReactNode {
  const a = node.attrs || {}
  switch (node.type) {
    case 'text': return renderText(node, key)
    case 'paragraph': return <p key={key}>{node.content?.length ? children(node) : <br />}</p>
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(a.level) || 2))
      const color = safeColor(a.sectionColor)
      const props = {
        'data-section': color ? '' : undefined,
        style: color ? ({ '--section-color': color } as CSSProperties) : undefined,
      }
      if (level === 1) return <h2 key={key} {...props}>{children(node)}</h2>
      if (level === 2) return <h3 key={key} {...props}>{children(node)}</h3>
      return <h4 key={key} {...props}>{children(node)}</h4>
    }
    case 'bulletList': return <ul key={key}>{children(node)}</ul>
    case 'orderedList': return <ol key={key} start={Number(a.start) || 1}>{children(node)}</ol>
    case 'listItem': return <li key={key}>{children(node)}</li>
    case 'taskList': return <ul key={key} data-type="taskList">{children(node)}</ul>
    case 'taskItem': return (
      <li key={key} data-checked={a.checked ? 'true' : 'false'}>
        <span className="share-check" aria-hidden>{a.checked ? '✓' : ''}</span>
        <div>{children(node)}</div>
      </li>
    )
    case 'blockquote': return <blockquote key={key}>{children(node)}</blockquote>
    case 'codeBlock': return <pre key={key}><code>{children(node)}</code></pre>
    case 'horizontalRule': return <hr key={key} />
    case 'hardBreak': return <br key={key} />
    default: return node.content ? <div key={key}>{children(node)}</div> : null
  }
}

/** true si le document n'a aucun texte. */
export function isEmptyDoc(doc: DocNode | null): boolean {
  if (!doc) return true
  const walk = (n: DocNode): boolean => !!n.text?.trim() || (n.content || []).some(walk)
  return !walk(doc)
}

export default function ScriptDoc({ doc }: { doc: DocNode }) {
  return <div className="share-doc">{children(doc)}</div>
}
