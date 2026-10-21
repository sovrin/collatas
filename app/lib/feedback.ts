import type { Kind, Status } from '../../shared/contracts'

/** How each feedback state reads on screen. Only `new` needs the owner, so only it takes a tone
 *  in its word; done shows a settled green marker, seen and spam stay untoned. */
export const feedbackStates: Record<
  Status,
  { label: string; tone?: 'success' | 'warning'; needsOwner?: boolean }
> = {
  new: { label: 'new', tone: 'warning', needsOwner: true },
  seen: { label: 'seen' },
  done: { label: 'done', tone: 'success' },
  spam: { label: 'spam' },
}

/** Each kind as a small icon in rows, with its label as the accessible name and tooltip. */
export const kindIcons: Record<Kind, string> = {
  problem: 'bug',
  idea: 'bulb',
  other: 'chat-dots',
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
