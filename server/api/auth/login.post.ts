import { ownerCredentialsSchema } from '#shared/contracts'
import { authenticate } from '../../core/auth'
import { checkAuthRate, setOwnerSession } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

export default defineEventHandler(async (event) => {
  checkAuthRate(event, 'login')
  const body = ownerCredentialsSchema.safeParse(await readBody(event))
  if (
    !body.success ||
    !(await authenticate(collatasDatabase(), body.data.email, body.data.password))
  ) {
    throw createError({ statusCode: 401, statusMessage: 'Email or password is incorrect.' })
  }
  setOwnerSession(event)
  return { email: body.data.email }
})
