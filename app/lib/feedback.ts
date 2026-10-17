import type { Status } from '#shared/contracts'

/** How each feedback state reads on screen. Only `new` needs the owner, so only it takes a tone
 *  in its word; done shows a settled green marker, seen and spam stay untoned. */
export const feedbackStates: Record<
  Status,
  { label: string; tone?: string; needsOwner?: boolean }
> = {
  new: { label: 'new', tone: 'warning', needsOwner: true },
  seen: { label: 'seen' },
  done: { label: 'done', tone: 'success' },
  spam: { label: 'spam' },
}

/** The first line of a message, for a row. */
export function excerpt(message: string) {
  return (
    message
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? message
  )
}
