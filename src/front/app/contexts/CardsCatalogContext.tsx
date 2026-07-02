"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CardCatalogEntry } from "@/lib/types";

const CardsCatalogContext = createContext<Record<string, CardCatalogEntry> | undefined>(undefined);

export function CardsCatalogProvider({
  catalog,
  children,
}: {
  catalog: Record<string, CardCatalogEntry> | undefined;
  children: ReactNode;
}) {
  return (
    <CardsCatalogContext.Provider value={catalog}>
      {children}
    </CardsCatalogContext.Provider>
  );
}

export function useCardsCatalog(): Record<string, CardCatalogEntry> | undefined {
  return useContext(CardsCatalogContext);
}
