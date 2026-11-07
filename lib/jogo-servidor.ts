import { getStore } from '@/lib/store'
import type { Estado, Jogo, Jogador, Tap } from '@/lib/game'

/**
 * Todo o jogo vive em UM hash do Redis, para a leitura gastar 1 comando só:
 *   estado        : JSON do estágio atual e das rodadas
 *   n:<id>        : nome do jogador
 *   p:<id>        : pontos do jogador
 *   t:r1:<i>      : quem levantou o serviço do evento i
 *   v:<id>        : última vez que o aparelho avisou presença
 */
export const H = 'congresso:jogo:h'
export const TTL = 60 * 60 * 48
export const LIMITE_JOGADORES = 500
const CACHE_MS = 1000
const JANELA_ONLINE = 50_000

type Cache = { t: number; bruto: Record<string, string> }
const g = globalThis as unknown as { __jogoCache?: Cache | null }

/** Leitura com cache de 1 segundo por instância: muitos celulares consultando juntos gastam 1 comando só. */
export async function lerBruto(fresco = false): Promise<Record<string, string>> {
  const c = g.__jogoCache
  if (!fresco && c && Date.now() - c.t < CACHE_MS) return c.bruto
  const bruto = await getStore().hgetall(H)
  g.__jogoCache = { t: Date.now(), bruto }
  return bruto
}

export function invalidar() {
  g.__jogoCache = null
}

export function estadoDe(b: Record<string, string>): Estado {
  if (!b.estado) return { estagio: 'lobby' }
  try {
    return JSON.parse(b.estado) as Estado
  } catch {
    return { estagio: 'lobby' }
  }
}

export function montarJogo(b: Record<string, string>, armazenamento: string): Jogo {
  const agora = Date.now()
  const jogadores: Jogador[] = []
  const taps: Record<string, Tap> = {}
  const reacoes: Record<string, number> = {}
  let online = 0
  for (const [k, v] of Object.entries(b)) {
    if (k.startsWith('n:')) {
      const id = k.slice(2)
      jogadores.push({ id, nome: v, pontos: Number(b[`p:${id}`] ?? 0) })
    } else if (k.startsWith('t:')) {
      try {
        taps[k.slice(2)] = JSON.parse(v) as Tap
      } catch {
        /* ignora registro quebrado */
      }
    } else if (k.startsWith('w:')) reacoes[k.slice(2)] = Number(v)
    else if (k.startsWith('v:') && agora - Number(v) < JANELA_ONLINE) online++
  }
  return { agora, estado: estadoDe(b), jogadores, taps, reacoes, armazenamento, online, hostLivre: !process.env.HOST_KEY }
}

export async function gravarEstado(e: Estado) {
  const s = getStore()
  await s.hset(H, 'estado', JSON.stringify(e))
  await s.expire(H, TTL)
  invalidar()
}

export async function registrarPresenca(id: string) {
  await getStore().hset(H, `v:${id}`, String(Date.now()))
}
