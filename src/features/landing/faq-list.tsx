'use client'

import { useState } from 'react'

type Faq = { q: string; a: string }

// Preguntas de la home: las primeras a la vista y el resto tras «Ver N más».
// Las ocultas siguen en el HTML (con `hidden`) para que Google las lea.
export function FaqList({ faqs, visible = 6 }: { faqs: Faq[]; visible?: number }) {
  const [open, setOpen] = useState(false)
  const rest = faqs.length - visible
  const item = (f: Faq) => (
    <details key={f.q}>
      <summary>{f.q}</summary>
      <p>{f.a}</p>
    </details>
  )
  return (
    <>
      <div className="faq-grid">{faqs.slice(0, visible).map(item)}</div>
      {rest > 0 && (
        <>
          <div className="faq-grid" id="faq-more" hidden={!open}>{faqs.slice(visible).map(item)}</div>
          <div className="more-q">
            <button className="btn btn-ghost" type="button" aria-expanded={open} aria-controls="faq-more" onClick={() => setOpen(!open)}>
              {open ? 'Ver menos preguntas' : `Ver ${rest} preguntas más`}
            </button>
          </div>
        </>
      )}
    </>
  )
}
