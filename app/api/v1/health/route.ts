import { ok } from '@/lib/api'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export function GET() {
  return ok({ status: 'ok', app: process.env.NEXT_PUBLIC_APP_NOME ?? 'congresso-jogo-watchdog', versao: '1.0.0', armazenamento: getStore().modo })
}
