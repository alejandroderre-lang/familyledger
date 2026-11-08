import { useEffect, useState } from 'react'
import {
  DEFAULT_DIRECTION,
  isDesignDirection,
  type DesignDirection,
} from './directions'

const STORAGE_KEY = 'familyledger.design'

function readInitial(): DesignDirection {
  if (typeof window === 'undefined') return DEFAULT_DIRECTION
  const fromUrl = new URLSearchParams(window.location.search).get('design')
  if (isDesignDirection(fromUrl)) return fromUrl
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isDesignDirection(stored)) return stored
  return DEFAULT_DIRECTION
}

/**
 * Resolves the active design direction and reflects it on <html data-design>.
 * URL wins over stored preference so a link pins a specific direction —
 * which is what makes the three comparable side by side.
 */
export function useDesign(): [DesignDirection, (next: DesignDirection) => void] {
  const [direction, setDirection] = useState<DesignDirection>(readInitial)

  useEffect(() => {
    document.documentElement.dataset.design = direction
    window.localStorage.setItem(STORAGE_KEY, direction)
  }, [direction])

  return [direction, setDirection]
}
