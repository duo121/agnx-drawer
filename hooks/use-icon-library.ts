"use client"

import { useEffect, useState } from "react"

// Library will be loaded from this URL
const LIBRARY_URL = "/icons/library.excalidrawlib"

interface ExcalidrawLibrary {
  type: "excalidrawlib"
  version: number
  source: string
  libraryItems: any[]
}

/**
 * Hook to load pre-processed icon library for Excalidraw
 * 
 * The library file should be placed at public/icons/library.excalidrawlib
 */
export function useIconLibrary() {
  const [libraryItems, setLibraryItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadLibrary() {
      try {
        const response = await fetch(LIBRARY_URL)
        if (!response.ok) {
          if (response.status === 404) {
            console.log("[useIconLibrary] No icon library found at", LIBRARY_URL)
            setLibraryItems([])
            setLoading(false)
            return
          }
          throw new Error(`Failed to load library: ${response.status}`)
        }

        const library: ExcalidrawLibrary = await response.json()
        
        if (cancelled) return

        if (library.type !== "excalidrawlib" || !Array.isArray(library.libraryItems)) {
          throw new Error("Invalid library format")
        }

        console.log(`[useIconLibrary] Loaded ${library.libraryItems.length} icons from ${LIBRARY_URL}`)
        setLibraryItems(library.libraryItems)
        setError(null)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : "Unknown error"
        console.error("[useIconLibrary] Error loading library:", message)
        setError(message)
        setLibraryItems([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLibrary()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    libraryItems,
    loading,
    error,
  }
}
