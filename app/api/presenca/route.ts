import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, erro } from '@/lib/api'
import { registrarPresenca } from '@/lib/jogo-servidor'

export const dynamic = 'force-dynamic'

const corpo = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) })

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return erro('DADOS_INVALIDOS', 'Dados inválidos')
  }
  const p = corpo.safeParse(json)
  if (!p.success) return erro('DADOS_INVALIDOS', 'Dados inválidos')
  await registrarPresenca(p.data.id)
  return ok({ ok: true })
}
