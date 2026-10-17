'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPet, addVaccine, archivePet, deleteVaccine } from '../actions'
import { Section } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Field, Input, Select } from '@/shared/components/ui/field'

export type PetRow = {
  id: string
  name: string
  species: string | null
  breed: string | null
  sex: string | null
  birth_date: string | null
  vaccines: { id: string; name: string; applied_on: string; next_due_on: string | null }[]
}

const fmtDay = (ymd: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`))

function age(birth: string | null): string | null {
  if (!birth) return null
  const months = Math.floor((Date.now() - Date.parse(birth)) / (30.44 * 86_400_000))
  if (months < 1) return 'recién nacido'
  return months < 24 ? `${months} meses` : `${Math.floor(months / 12)} años`
}

/** Mascotas del cliente con su cartilla (fase 3). La próxima dosis programa el recordatorio. */
export function PetsSection({ clientId, pets }: { clientId: string; pets: PetRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(pets.length === 0)
  const [form, setForm] = useState({ name: '', species: '', breed: '', sex: '', birthDate: '' })

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setError(res.error ?? 'No se pudo guardar.')
      after?.()
      router.refresh()
    })
  }

  return (
    <Section title="Mascotas" description="Su ficha y cartilla de vacunas. Tu recepcionista las llama por su nombre y avisa cuando toca la siguiente dosis.">
      <div className="space-y-4" data-testid="pets-section">
        {pets.map((p) => (
          <PetCard key={p.id} pet={p} clientId={clientId} pending={pending} run={run} />
        ))}
        {pets.length === 0 && !adding && <p className="text-[14.5px] text-ink-muted">Sin mascotas registradas.</p>}

        {adding ? (
          <div className="grid gap-3 rounded-[14px] bg-surface p-3.5 sm:grid-cols-2">
            <Field label="Nombre">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Firulais" data-testid="pet-name" />
            </Field>
            <Field label="Especie">
              <Input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="Perro, gato…" />
            </Field>
            <Field label="Raza">
              <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="Sexo">
              <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">—</option>
                <option value="macho">Macho</option>
                <option value="hembra">Hembra</option>
              </Select>
            </Field>
            <Field label="Fecha de nacimiento">
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                disabled={pending || !form.name.trim()}
                data-testid="pet-save"
                onClick={() =>
                  run(
                    () =>
                      addPet({
                        clientId,
                        name: form.name,
                        species: form.species || undefined,
                        breed: form.breed || undefined,
                        sex: form.sex || undefined,
                        birthDate: form.birthDate || undefined,
                      }),
                    () => {
                      setForm({ name: '', species: '', breed: '', sex: '', birthDate: '' })
                      setAdding(false)
                    }
                  )
                }
              >
                Guardar mascota
              </Button>
              {pets.length > 0 && (
                <Button variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Agregar mascota
          </Button>
        )}
        {error && (
          <p role="alert" className="text-[13.5px] text-[#a51b18]">
            {error}
          </p>
        )}
      </div>
    </Section>
  )
}

function PetCard({
  pet,
  clientId,
  pending,
  run,
}: {
  pet: PetRow
  clientId: string
  pending: boolean
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void
}) {
  const [vac, setVac] = useState({ name: '', appliedOn: '', nextDueOn: '' })
  const info = [pet.species, pet.breed, pet.sex, age(pet.birth_date)].filter(Boolean).join(' · ')

  return (
    <article className="rounded-[14px] border-2 border-line p-3.5" data-testid="pet-card">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[16px] font-bold text-ink">
          🐾 {pet.name} {info && <span className="text-[13.5px] font-normal text-ink-muted">· {info}</span>}
        </p>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => archivePet(pet.id, clientId))}>
          Dar de baja
        </Button>
      </header>

      <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-muted">Cartilla de vacunas</h3>
      {pet.vaccines.length === 0 ? (
        <p className="mb-2 text-[14px] text-ink-muted">Sin vacunas registradas.</p>
      ) : (
        <ul className="mb-2 divide-y divide-line text-[14px]">
          {pet.vaccines.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <b className="font-semibold text-ink">{v.name}</b>
              <span className="tabular-nums text-ink-muted">aplicada {fmtDay(v.applied_on)}</span>
              {v.next_due_on && <span className="tabular-nums text-ink">· próxima {fmtDay(v.next_due_on)}</span>}
              <button
                type="button"
                className="ml-auto min-h-[36px] rounded-[10px] px-2 text-[13px] font-semibold text-[#a51b18] hover:bg-[#fde3e1]"
                disabled={pending}
                onClick={() => run(() => deleteVaccine(v.id, clientId))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[9rem] flex-1">
          <span className="mb-1 block text-[12.5px] font-semibold text-ink">Vacuna</span>
          <Input value={vac.name} onChange={(e) => setVac({ ...vac, name: e.target.value })} placeholder="Rabia" />
        </label>
        <label>
          <span className="mb-1 block text-[12.5px] font-semibold text-ink">Aplicada</span>
          <Input type="date" value={vac.appliedOn} onChange={(e) => setVac({ ...vac, appliedOn: e.target.value })} />
        </label>
        <label>
          <span className="mb-1 block text-[12.5px] font-semibold text-ink">Próxima dosis</span>
          <Input type="date" value={vac.nextDueOn} onChange={(e) => setVac({ ...vac, nextDueOn: e.target.value })} />
        </label>
        <Button
          size="sm"
          disabled={pending || !vac.name.trim() || !vac.appliedOn}
          data-testid="vaccine-save"
          onClick={() =>
            run(
              () => addVaccine({ petId: pet.id, clientId, name: vac.name, appliedOn: vac.appliedOn, nextDueOn: vac.nextDueOn || undefined }),
              () => setVac({ name: '', appliedOn: '', nextDueOn: '' })
            )
          }
        >
          Registrar vacuna
        </Button>
      </div>
    </article>
  )
}
