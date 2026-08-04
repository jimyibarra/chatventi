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
import { clearVoice, saveVoice } from '../actions'

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

  function set<K extends keyof VoiceProfile>(key: K, value: VoiceProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
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

      <details className="mt-5 rounded-lg border border-line bg-surface p-4" open={preset === 'custom'}>
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
