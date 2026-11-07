import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, erro } from '@/lib/api'
import { getStore } from '@/lib/store'
import { H, gravarEstado, lerBruto, estadoDe, invalidar } from '@/lib/jogo-servidor'
import { CONTAGEM, DUR_R1, DUR_WD, gerarEventos } from '@/lib/game'

export const dynamic = 'force-dynamic'

const corpo = z.object({ acao: z.enum(['lobby', 'r1', 'wd', 'end', 'reset']), key: z.string().optional() })

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return erro('DADOS_INVALIDOS', 'Dados inválidos')
  }
  const p = corpo.safeParse(json)
  if (!p.success) return erro('DADOS_INVALIDOS', 'Ação inválida')
  const chave = process.env.HOST_KEY
  if (chave && p.data.key !== chave) return erro('SEM_PERMISSAO', 'Chave do host incorreta')

  const s = getStore()
  const agora = Date.now()
  const b = await lerBruto(true)
  const atual = estadoDe(b)
  const zerarPlacar = () => s.hdel(H, Object.keys(b).filter((k) => k.startsWith('p:') || k.startsWith('t:') || k.startsWith('w:') || k.startsWith('x:')))
  switch (p.data.acao) {
    case 'reset':
      await s.del(H)
      invalidar()
      break
    case 'lobby':
      await zerarPlacar()
      await gravarEstado({ estagio: 'lobby' })
      break
    case 'r1':
      await zerarPlacar()
      await gravarEstado({ estagio: 'r1', r1: { t0: agora + CONTAGEM, dur: DUR_R1, eventos: gerarEventos(DUR_R1) } })
      break
    case 'wd':
      await s.hdel(H, Object.keys(b).filter((k) => k.startsWith('w:') || k.startsWith('x:')))
      await gravarEstado({ ...atual, estagio: 'wd', wd: { t0: agora + CONTAGEM, dur: DUR_WD, eventos: gerarEventos(DUR_WD, true) } })
      break
    case 'end':
      await gravarEstado({ ...atual, estagio: 'end' })
      break
  }
  return ok({ acao: p.data.acao })
}
