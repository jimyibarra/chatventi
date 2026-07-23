'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/shared/components/image-upload'
import { addProduct, deleteProduct, setProductImage } from '../actions'

type Product = {
  id: string
  name: string
  price: number | null
  description: string | null
  image_url: string | null
}

export function ProductManager({ orgId, products }: { orgId: string; products: Product[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await addProduct({
        name,
        price: price === '' ? null : price,
        description: description || undefined,
      })
      if (res.ok) {
        setName('')
        setPrice('')
        setDescription('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteProduct(id)
      router.refresh()
    })
  }

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-ink">Tienda (productos)</h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="product-name"
            className="rounded-lg border border-line px-3 py-1.5 text-sm focus:border-brand-400"
            placeholder="Cera moldeadora"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Precio</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded-lg border border-line px-3 py-1.5 text-sm focus:border-brand-400"
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-ink-soft">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm focus:border-brand-400"
            placeholder="Opcional"
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !name}
          data-testid="add-product"
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-btn hover:bg-brand-600 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      <ul className="divide-y divide-line-row">
        {products.length === 0 && (
          <li className="py-2 text-sm text-ink-faint">Aún no hay productos.</li>
        )}
        {products.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <ImageUpload
                orgId={orgId}
                folder="products"
                currentUrl={p.image_url}
                shape="square"
                label="Subir foto"
                hint="Foto del producto. PNG o JPG, máx 5 MB."
                onChange={async (url) => (await setProductImage(p.id, url)).ok}
              />
              <span className="text-ink-muted">
                {p.name}
                {p.price != null ? ` · $${p.price}` : ''}
              </span>
            </div>
            <button
              onClick={() => remove(p.id)}
              disabled={pending}
              className="text-xs text-rose-600 hover:underline"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
