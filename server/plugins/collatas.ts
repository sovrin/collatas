import { registerModule } from '#nexitas/server/utils/nexitas'
import { collatas } from '../core/module'

// Registers collatas with the core, which runs its hourly cleanup while the owner has it on.
export default defineNitroPlugin(() => registerModule(collatas))
