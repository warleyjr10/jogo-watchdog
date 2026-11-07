import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, erro } from '@/lib/api'
import { getStore } from '@/lib/store'
import { H, lerBruto, estadoDe, invalidar } from '@/lib/jogo-servidor'
import { chaveReacao, chaveTap, type Tap } from '@/lib/game'

export const dynamic = 'force-dynamic'

const corpo = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), s: z.enum(['gw', 'me', 're', 'pl']) })

export async function POST(req: NextRequest) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return erro('DADOS_INVALIDOS', 'Dados inválidos')
  }
  const p = corpo.safeParse(json)
  if (!p.success) return erro('DADOS_INVALIDOS', 'Dados inválidos')

  const store = getStore()
  const b = await lerBruto(true) // leitura fresca: quem levantou primeiro precisa ser decidido com o dado de agora
  if (b[`n:${p.data.id}`] === undefined) return erro('NAO_AUTENTICADO', 'Entre no jogo com seu nome primeiro')
  const estado = estadoDe(b)
  const r = estado.r1
  const agora = Date.now()
  // Rodada com Watchdog: a pessoa também toca, só para medir o tempo de reação dela contra o do Watchdog (sem pontos).
  if (estado.estagio === 'wd' && estado.wd) {
    const relw = agora - estado.wd.t0
    if (relw < 0 || relw > estado.wd.dur) return ok({ resultado: 'fora' as const })
    const pendw = estado.wd.eventos.filter((e) => e.s === p.data.s && e.at <= relw && b[`w:${chaveReacao(e.i, p.data.id)}`] === undefined)
    if (pendw.length === 0) return ok({ resultado: 'fora' as const })
    const ev = pendw[0]
    const ms = relw - ev.at
    await store.hsetnx(H, `w:${chaveReacao(ev.i, p.data.id)}`, String(ms))
    invalidar()
    return ok({ resultado: 'wd' as const, ms })
  }
  if (estado.estagio !== 'r1' || !r) return ok({ resultado: 'fora' as const })
  const rel = agora - r.t0
  if (rel < 0 || rel > r.dur) return ok({ resultado: 'fora' as const })

  const pend = r.eventos.filter((e) => e.s === p.data.s && e.at <= rel && b[`t:${chaveTap('r1', e.i)}`] === undefined)
  if (pend.length === 0) {
    if (Number(b[`p:${p.data.id}`] ?? 0) >= 5) await store.hincrby(H, `p:${p.data.id}`, -5)
    invalidar()
    return ok({ resultado: 'penal' as const, pts: -5 })
  }

  const primeiro = pend[0]
  const pts = Math.max(10, Math.round(100 - ((rel - primeiro.at) / 1000) * 15))
  const venceu = await store.hsetnx(H, `t:${chaveTap('r1', primeiro.i)}`, JSON.stringify({ p: p.data.id, t: agora, pts } satisfies Tap))
  if (!venceu) {
    invalidar()
    return ok({ resultado: 'perdeu' as const })
  }
  for (const e of pend.slice(1)) await store.hsetnx(H, `t:${chaveTap('r1', e.i)}`, JSON.stringify({ p: p.data.id, t: agora, pts: 0 } satisfies Tap))
  await store.hincrby(H, `p:${p.data.id}`, pts)
  invalidar()
  return ok({ resultado: 'ok' as const, pts })
}
