import * as React from "react"

const MOBILE_BREAKPOINT = 768

const mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}

  const mql = window.matchMedia(mediaQuery)
  mql.addEventListener("change", callback)

  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  if (typeof window === "undefined") return false

  return window.matchMedia(mediaQuery).matches
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
