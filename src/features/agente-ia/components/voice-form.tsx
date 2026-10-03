'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PRESET_LABELS,
  PRESET_PROFILES,
  VOICE_EMOJI,
  VOICE_ENERGIES,
  VOICE_SENTENCES,
  VOICE_TREATMENTS,
  QUIRK_MAX_COUNT,
  type VoiceProfile,
} from '../voice'
import { analyzeVoiceUrl, clearVoice, saveVoice } from '../actions'
import { Inset, Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Select } from '@/shared/components/ui/field'
import { Icon } from '@/shared/components/ui/icon'

/** Resumen legible del retrato, para que el dueño vea qué se dedujo. */
function describeProfile(p: VoiceProfile): string {
  const parts = [
    p.treatment === 'tu' ? 'de tú' : 'de usted',
    p.energy === 'baja' ? 'tono tranquilo' : p.energy === 'alta' ? 'tono enérgico' : 'tono cordial',
    p.emoji === 'nunca' ? 'sin emojis' : p.emoji === 'frecuente' ? 'con emojis' : 'algún emoji',
    p.sentence === 'corta' ? 'frases cortas' : p.sentence === 'larga' ? 'frases largas' : 'frases medias',
  ]
  if (p.quirks.length) parts.push(`dice ${p.quirks.map((q) => `"${q}"`).join(', ')}`)
  return parts.join(', ')
}

const TREATMENT_LABEL: Record<VoiceProfile['treatment'], string> = { tu: 'De tú', usted: 'De usted' }
const ENERGY_LABEL: Record<VoiceProfile['energy'], string> = { baja: 'Tranquila', media: 'Cordial', alta: 'Enérgica' }
const EMOJI_LABEL: Record<VoiceProfile['emoji'], string> = { nunca: 'Nunca', ocasional: 'A veces', frecuente: 'A menudo' }
const SENTENCE_LABEL: Record<VoiceProfile['sentence'], string> = { corta: 'Cortas', media: 'Medias', larga: 'Largas' }

type Props = {
  initialPreset: string | null
  initialProfile: VoiceProfile | null
}

export function VoiceForm({ initialPreset, initialProfile }: Props) {
  const router = useRouter()
  const [preset, setPreset] = useState<string>(initialPreset ?? '')
  const [profile, setProfile] = useState<VoiceProfile>(
    initialProfile ?? PRESET_PROFILES.calido
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  function set<K extends keyof VoiceProfile>(key: K, value: VoiceProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  // Analiza y MUESTRA el resultado. No guarda: el dueño revisa y decide.
  async function onAnalyze() {
    setAnalyzing(true)
    setMsg(null)
    setAnalyzed(false)
    const result = await analyzeVoiceUrl({ url })
    setAnalyzing(false)
    if (!result.ok) {
      setMsg({ ok: false, text: result.error })
      return
    }
    setProfile(result.profile)
    setSourceUrl(result.sourceUrl)
    setAnalyzed(true)
  }

  async function onSave(nextPreset: string) {
    setSaving(true)
    setMsg(null)
    const result =
      nextPreset === ''
        ? await clearVoice()
        : await saveVoice({
            preset: nextPreset,
            profile: nextPreset === 'custom' ? profile : null,
            sourceUrl: nextPreset === 'custom' ? sourceUrl : null,
          })
    setSaving(false)
    if (!result.ok) {
      setMsg({ ok: false, text: result.error })
      return
    }
    setPreset(nextPreset)
    setMsg({
      ok: true,
      text:
        nextPreset === ''
          ? 'Voz quitada. El agente vuelve a su tono por defecto.'
          : 'Voz guardada. Pruébala en el chat de prueba antes de que atienda a un cliente.',
    })
    router.refresh()
  }

  return (
    <Section
      title="Voz de marca"
      description={
        <>
          Cambia <strong className="text-ink">cómo suena</strong> tu recepcionista. No cambia lo que puede hacer: siga el
          tono que siga, nunca inventará precios ni horarios y seguirá escalando a una persona cuando toque.
        </>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-3" role="group" aria-label="Tonos listos">
        {(Object.keys(PRESET_LABELS) as (keyof typeof PRESET_LABELS)[]).map((key) => {
          const on = preset === key
          return (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => onSave(key)}
              aria-pressed={on}
              className={`relative rounded-[16px] p-4 text-left transition-[background-color,box-shadow] duration-150 disabled:opacity-60 ${
                on ? 'bg-brand-50 shadow-[inset_0_0_0_2px_#2a1a5e]' : 'bg-surface hover:shadow-[inset_0_0_0_2px_#c4bff5]'
              }`}
            >
              {on && (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-ink text-white" aria-hidden>
                  <Icon name="check" className="h-3 w-3" strokeWidth={3.2} />
                </span>
              )}
              <span className="block pr-6 text-[15px] font-bold text-ink">{PRESET_LABELS[key].label}</span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-muted">{PRESET_LABELS[key].hint}</span>
            </button>
          )
        })}
      </div>

      <Inset className="mt-4">
        <Field
          as="div"
          label="O haz que suene como tu negocio"
          hint="Pega la dirección de tu sitio web y deducimos tu forma de escribir. Podrás revisarla antes de activarla."
        >
          <div className="flex flex-wrap gap-2">
            <Input
              type="url"
              inputMode="url"
              aria-label="Dirección de tu sitio web"
              placeholder="https://minegocio.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-w-[min(100%,14rem)] flex-1"
            />
            <Button variant="secondary" disabled={analyzing || saving || !url.trim()} onClick={onAnalyze}>
              <Icon name="search" />
              {analyzing ? 'Analizando…' : 'Analizar mi sitio'}
            </Button>
          </div>
        </Field>
        {analyzed && (
          <p className="mt-3 rounded-[12px] bg-white px-3.5 py-2.5 text-[14px] leading-snug text-ink">
            Esto es lo que deducimos: <strong>{describeProfile(profile)}</strong>. Revísalo abajo,
            ajústalo si quieres y guárdalo.
          </p>
        )}
      </Inset>

      <details className="group mt-4 rounded-[16px] bg-surface" open={preset === 'custom' || analyzed}>
        <summary className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-[16px] px-4 text-[15px] font-semibold text-ink">
          <Icon name="settings" className="h-[18px] w-[18px] text-ink-muted" />
          Ajustar a mano
          <Icon name="chevronDown" className="cv-chevron ml-auto h-4 w-4 text-ink-muted" />
        </summary>

        <div className="px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Trato">
              <Select value={profile.treatment} onChange={(e) => set('treatment', e.target.value as VoiceProfile['treatment'])}>
                {VOICE_TREATMENTS.map((v) => (
                  <option key={v} value={v}>{TREATMENT_LABEL[v]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Energía">
              <Select value={profile.energy} onChange={(e) => set('energy', e.target.value as VoiceProfile['energy'])}>
                {VOICE_ENERGIES.map((v) => (
                  <option key={v} value={v}>{ENERGY_LABEL[v]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Emojis">
              <Select value={profile.emoji} onChange={(e) => set('emoji', e.target.value as VoiceProfile['emoji'])}>
                {VOICE_EMOJI.map((v) => (
                  <option key={v} value={v}>{EMOJI_LABEL[v]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Frases">
              <Select value={profile.sentence} onChange={(e) => set('sentence', e.target.value as VoiceProfile['sentence'])}>
                {VOICE_SENTENCES.map((v) => (
                  <option key={v} value={v}>{SENTENCE_LABEL[v]}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            className="mt-3"
            label="Palabras propias de tu negocio"
            hint={`Separadas por comas, máximo ${QUIRK_MAX_COUNT}. Se usan como vocabulario, no como instrucciones.`}
          >
            <Input
              type="text"
              placeholder="peluditos, consentirte"
              defaultValue={profile.quirks.join(', ')}
              onBlur={(e) =>
                set(
                  'quirks',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, QUIRK_MAX_COUNT)
                )
              }
            />
          </Field>

          <Button disabled={saving} onClick={() => onSave('custom')} className="mt-4">
            {saving ? 'Guardando…' : 'Guardar mi voz'}
          </Button>
        </div>
      </details>

      {msg && (
        <p className={`mt-4 text-sm ${msg.ok ? 'text-[#0b5d36]' : 'text-[#a51b18]'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}

      {preset && (
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => onSave('')} className="-ml-2 mt-3">
          Quitar la voz y volver al tono por defecto
        </Button>
      )}
    </Section>
  )
}
