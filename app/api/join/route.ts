import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, erro } from '@/lib/api'
import { getStore } from '@/lib/store'
import { H, TTL, LIMITE_JOGADORES, lerBruto, invalidar } from '@/lib/jogo-servidor'

export const dynamic = 'force-dynamic'

const corpo = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Identificador inválido'),
  nome: z.string().trim().min(1, 'Escreva seu nome').max(20, 'O nome pode ter até 20 letras'),
})

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return erro('DADOS_INVALIDOS', 'Dados inválidos')
  }
  const p = corpo.safeParse(json)
  if (!p.success) return erro('DADOS_INVALIDOS', p.error.issues[0]?.message ?? 'Dados inválidos')
  const b = await lerBruto()
  const jaTem = b[`n:${p.data.id}`] !== undefined
  if (!jaTem && Object.keys(b).filter((k) => k.startsWith('n:')).length >= LIMITE_JOGADORES) return erro('CONFLITO', 'A sala está cheia')
  const s = getStore()
  await s.hset(H, `n:${p.data.id}`, p.data.nome)
  if (!jaTem) await s.expire(H, TTL)
  invalidar()
  return ok({ id: p.data.id })
}
