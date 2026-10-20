import { listApps } from '../../core/apps'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'

// Every app, or the one of ?project=.
export default defineEventHandler((event) => {
  const { project } = getQuery(event)
  const apps = listApps(nexitasDatabase())
  return typeof project === 'string' ? apps.filter((app) => app.projectId === project) : apps
})
