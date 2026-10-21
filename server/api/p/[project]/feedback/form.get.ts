import type { AppSummary } from '../../../../../shared/contracts'
import { getProjectAppSummary } from '../../../../core/apps'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'

// The project's feedback form, or null for a project that collects none. Wrapped, since a bare
// null answers 204 with no body.
export default defineEventHandler((event): { app: AppSummary | null } => {
  return { app: getProjectAppSummary(nexitasDatabase(), requestProject(event).id) }
})
