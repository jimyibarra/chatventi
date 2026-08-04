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

const SELECT =
  'mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

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
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">Voz de marca</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Cambia <strong>cómo suena</strong> tu recepcionista. No cambia lo que puede hacer: siga el
        tono que siga, nunca inventará precios ni horarios y seguirá escalando a una persona cuando
        toque.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(Object.keys(PRESET_LABELS) as (keyof typeof PRESET_LABELS)[]).map((key) => (
          <button
            key={key}
            type="button"
            disabled={saving}
            onClick={() => onSave(key)}
            className={`rounded-lg border p-4 text-left transition-colors disabled:opacity-50 ${
              preset === key
                ? 'border-brand-400 bg-brand-50'
                : 'border-line bg-surface hover:border-brand-200'
            }`}
          >
            <span className="block text-sm font-semibold text-ink">{PRESET_LABELS[key].label}</span>
            <span className="mt-1 block text-xs text-ink-muted">{PRESET_LABELS[key].hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-surface p-4">
        <label className="block text-sm font-medium text-ink">
          O haz que suene como tu negocio
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          Pega la dirección de tu sitio web y deducimos tu forma de escribir. Podrás revisarla
          antes de activarla.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="url"
            inputMode="url"
            placeholder="https://minegocio.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <button
            type="button"
            disabled={analyzing || saving || !url.trim()}
            onClick={onAnalyze}
            className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            {analyzing ? 'Analizando…' : 'Analizar mi sitio'}
          </button>
        </div>
        {analyzed && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            Esto es lo que deducimos: <strong>{describeProfile(profile)}</strong>. Revísalo abajo,
            ajústalo si quieres y guárdalo.
          </p>
        )}
      </div>

      <details className="mt-5 rounded-lg border border-line bg-surface p-4" open={preset === 'custom' || analyzed}>
        <summary className="cursor-pointer text-sm font-medium text-ink">
          Ajustar a mano
        </summary>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink-muted">Trato</label>
            <select
              className={SELECT}
              value={profile.treatment}
              onChange={(e) => set('treatment', e.target.value as VoiceProfile['treatment'])}
            >
              {VOICE_TREATMENTS.map((v) => (
                <option key={v} value={v}>{TREATMENT_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted">Energía</label>
            <select
              className={SELECT}
              value={profile.energy}
              onChange={(e) => set('energy', e.target.value as VoiceProfile['energy'])}
            >
              {VOICE_ENERGIES.map((v) => (
                <option key={v} value={v}>{ENERGY_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted">Emojis</label>
            <select
              className={SELECT}
              value={profile.emoji}
              onChange={(e) => set('emoji', e.target.value as VoiceProfile['emoji'])}
            >
              {VOICE_EMOJI.map((v) => (
                <option key={v} value={v}>{EMOJI_LABEL[v]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted">Frases</label>
            <select
              className={SELECT}
              value={profile.sentence}
              onChange={(e) => set('sentence', e.target.value as VoiceProfile['sentence'])}
            >
              {VOICE_SENTENCES.map((v) => (
                <option key={v} value={v}>{SENTENCE_LABEL[v]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-ink-muted">
            Palabras propias de tu negocio
          </label>
          <input
            type="text"
            className={SELECT}
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
          <p className="mt-1 text-xs text-ink-faint">
            Separadas por comas, máximo {QUIRK_MAX_COUNT}. Se usan como vocabulario, no como
            instrucciones.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('custom')}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar mi voz'}
        </button>
      </details>

      {msg && (
        <p className={`mt-4 text-sm ${msg.ok ? 'text-success' : 'text-red-600'}`}>{msg.text}</p>
      )}

      {preset && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('')}
          className="mt-4 text-sm text-ink-muted underline hover:text-ink disabled:opacity-50"
        >
          Quitar la voz y volver al tono por defecto
        </button>
      )}
    </section>
  )
}
