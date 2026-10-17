'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addClinicalNote, createClinicalProfile, updateClinicalProfile } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { CHECKBOX, Field, Input, Select, Textarea } from '@/shared/components/ui/field'

export type ClinicalProfile = {
  reason: string | null
  allergies: string | null
  conditions: string | null
  medications: string | null
  notes: string | null
  consent_at: string
  consent_method: string
}
export type ClinicalNote = { id: string; occurred_on: string; note: string; next_control_on: string | null; created_at: string }

const FIELDS: { key: keyof Pick<ClinicalProfile, 'reason' | 'allergies' | 'conditions' | 'medications' | 'notes'>; label: string; rows: number; hint?: string }[] = [
  { key: 'reason', label: 'Motivo de consulta', rows: 2 },
  { key: 'allergies', label: 'Alergias', rows: 2, hint: 'Medicamentos, alimentos, látex…' },
  { key: 'conditions', label: 'Antecedentes', rows: 3, hint: 'Enfermedades, cirugías, embarazo…' },
  { key: 'medications', label: 'Medicamentos actuales', rows: 2 },
  { key: 'notes', label: 'Observaciones', rows: 2 },
]

const METHOD_LABEL: Record<string, string> = { firma_papel: 'firmado en papel', firma_digital: 'firma digital', otro: 'otro medio' }

const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`))
const fmtTs = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).format(new Date(iso))

type Form = Record<(typeof FIELDS)[number]['key'], string>
const toForm = (p: ClinicalProfile | null): Form => ({
  reason: p?.reason ?? '',
  allergies: p?.allergies ?? '',
  conditions: p?.conditions ?? '',
  medications: p?.medications ?? '',
  notes: p?.notes ?? '',
})

/**
 * Ficha clínica (fase 5): consentimiento → formulario de primera vez → notas por
 * consulta (solo se agregan). Solo dueño y gerente la ven; la IA nunca la lee.
 */
export function ClinicalSection({ clientId, profile, notes, today }: { clientId: string; profile: ClinicalProfile | null; notes: ClinicalNote[]; today: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState<Form>(toForm(profile))
  const [consent, setConsent] = useState(false)
  const [method, setMethod] = useState('firma_papel')
  const [note, setNote] = useState({ text: '', on: today, next: '' })

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) {
    setMsg(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? 'No se pudo guardar.' })
      setMsg({ ok: true, text: okText })
      after?.()
      router.refresh()
    })
  }

  return (
    <Section
      title="Ficha clínica"
      description="Datos de salud del paciente: son datos sensibles. Solo tú y tus gerentes los ven; tu recepcionista IA no tiene acceso."
    >
      <div className="space-y-4" data-testid="clinical-section">
        {!profile && (
          <div className="space-y-2 rounded-[14px] bg-[#fff2cf] p-3.5 text-[14px] text-ink">
            <p>
              <b>Antes de guardar datos de salud necesitas el consentimiento expreso del paciente</b>, de preferencia firmado. Registra cómo lo diste.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className={CHECKBOX} checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="clinical-consent" />
                El paciente dio su consentimiento
              </label>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} wrapperClassName="w-[13rem]" aria-label="Cómo lo dio">
                <option value="firma_papel">Firmado en papel</option>
                <option value="firma_digital">Firma digital</option>
                <option value="otro">Otro medio</option>
              </Select>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} className={f.key === 'conditions' || f.key === 'notes' ? 'sm:col-span-2' : ''}>
              <Textarea rows={f.rows} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={!profile && !consent} />
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {profile ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => updateClinicalProfile({ clientId, ...form }), 'Ficha actualizada.')}>
              Guardar cambios
            </Button>
          ) : (
            <Button
              disabled={pending || !consent}
              data-testid="clinical-create"
              onClick={() => run(() => createClinicalProfile({ clientId, consent: true, consentMethod: method, ...form }), 'Ficha creada.')}
            >
              Crear ficha clínica
            </Button>
          )}
          {profile && (
            <span className="text-[13px] text-ink-muted">
              Consentimiento: {METHOD_LABEL[profile.consent_method] ?? profile.consent_method}, {fmtTs(profile.consent_at)}
            </span>
          )}
        </div>

        {profile && (
          <div className="space-y-3 border-t border-line pt-4">
            <h3 className="text-[15px] font-bold text-ink">Notas de consulta</h3>
            <div className="grid gap-3 rounded-[14px] bg-surface p-3.5">
              <Field label="Nota de la consulta">
                <Textarea rows={3} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} placeholder="Lo que se hizo, hallazgos e indicaciones." data-testid="clinical-note" />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Fecha" className="w-[11rem]">
                  <Input type="date" value={note.on} onChange={(e) => setNote({ ...note, on: e.target.value })} />
                </Field>
                <Field label="Próximo control (opcional)" className="w-[13rem]" hint="Le llega un aviso ese día.">
                  <Input type="date" value={note.next} onChange={(e) => setNote({ ...note, next: e.target.value })} />
                </Field>
                <Button
                  disabled={pending || !note.text.trim()}
                  data-testid="clinical-note-save"
                  onClick={() =>
                    run(
                      () => addClinicalNote({ clientId, note: note.text, occurredOn: note.on, nextControlOn: note.next || undefined }),
                      'Nota guardada.',
                      () => setNote({ text: '', on: today, next: '' })
                    )
                  }
                >
                  Agregar nota
                </Button>
              </div>
              <p className="text-[12.5px] text-ink-muted">Las notas no se editan ni se borran: el expediente clínico se conserva.</p>
            </div>
            {notes.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Sin notas todavía.</p>
            ) : (
              <ol className="space-y-2.5">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-[12px] border-2 border-line px-3.5 py-2.5">
                    <p className="mb-1 text-[12.5px] font-semibold tabular-nums text-ink-muted">
                      {fmtDay(n.occurred_on)}
                      {n.next_control_on && ` · próximo control ${fmtDay(n.next_control_on)}`}
                    </p>
                    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{n.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`text-[13.5px] ${msg.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </Section>
  )
}
