import { ok } from '@/lib/api'
import { getStore } from '@/lib/store'
import { lerBruto, montarJogo } from '@/lib/jogo-servidor'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok(montarJogo(await lerBruto(), getStore().modo))
}
