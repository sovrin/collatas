// Who is watching: one callback per open admin tab (see api/events.get.ts). Kept in memory, which
// holds because collatas runs as a single process.
type Listener = () => void

const listeners = new Set<Listener>()

/** Hear about every change; returns how to stop. */
export function onChange(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Something the admin shows has changed: tell every open admin tab to look again. */
export function announceChange() {
  for (const listener of listeners) listener()
}
