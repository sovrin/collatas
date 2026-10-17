import { requireOwner, routeApp } from '../../utils/auth'

export default defineEventHandler((event) => {
  requireOwner(event)
  return routeApp(event)
})
