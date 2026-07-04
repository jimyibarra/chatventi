'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addProduct, deleteProduct } from '../actions'

type Product = { id: string; name: string; price: number | null; description: string | null }

export function ProductManager({ products }: { products: Product[] }) {
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">Tienda (productos)</h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="product-name"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Cera moldeadora"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Precio</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Opcional"
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !name}
          data-testid="add-product"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      <ul className="divide-y divide-gray-100">
        {products.length === 0 && (
          <li className="py-2 text-sm text-gray-400">Aún no hay productos.</li>
        )}
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-gray-800">
              {p.name}
              {p.price != null ? ` · $${p.price}` : ''}
            </span>
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
