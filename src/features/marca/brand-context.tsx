'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { CHATVENTI, type Brand } from './brand-shared'

// La marca llega del servidor (currentBrand) y los componentes de cliente la
// leen de aquí: nombre, correo de soporte y si es la de un socio.
const BrandContext = createContext<Brand>(CHATVENTI)

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useBrand(): Brand {
  return useContext(BrandContext)
}
