export type Svc = 'gw' | 'me' | 're' | 'pl'
export const SERVICOS: { id: Svc; n: string; d: string }[] = [
  { id: 'gw', n: 'Gateway', d: 'API e alarmes' },
  { id: 'me', n: 'Medições', d: 'Cálculo e gravação' },
  { id: 're', n: 'Relatórios', d: 'PDF, XLS e e-mail' },
  { id: 'pl', n: 'PLCCOM', d: 'Ponte com o CLP' },
]
export const NOME: Record<Svc, string> = { gw: 'Gateway', me: 'Medições', re: 'Relatórios', pl: 'PLCCOM' }

export const DUR_R1 = 45_000
export const DUR_WD = 30_000
/** Tempo máximo que o Watchdog leva para recuperar um serviço (valor ilustrativo da brincadeira, bem mais rápido que uma pessoa). */
export const CONSERTO_WD = 250
/** Tempo mínimo: cada queda sorteia um tempo entre WD_MIN e CONSERTO_WD, nunca acima de CONSERTO_WD. */
export const WD_MIN = 150
/** Placar de reação: queda que a pessoa não levantou conta este tempo, e cada toque em serviço no ar soma esta penalidade. */
export const TETO_REACAO_MS = 3_000
export const PENAL_ERRO_MS = 500

export const fmtS = (ms: number, casas = 1) => (ms / 1000).toFixed(casas).replace('.', ',')
export const CONTAGEM = 3_000

export type Evento = { i: number; s: Svc; at: number; r?: number }
export type Rodada = { t0: number; dur: number; eventos: Evento[] }
export type Estagio = 'lobby' | 'r1' | 'wd' | 'end'
export type Estado = { estagio: Estagio; r1?: Rodada; wd?: Rodada }
export type Tap = { p: string; t: number; pts: number }
export type Jogador = { id: string; nome: string; pontos: number }
export type Jogo = { agora: number; estado: Estado; jogadores: Jogador[]; taps: Record<string, Tap>; reacoes: Record<string, number>; erros: Record<string, number>; armazenamento: string; online: number; hostLivre: boolean }

/** Chave do tempo de reação de um jogador a uma queda na rodada com Watchdog (valor em ms). */
export const chaveReacao = (i: number, jogador: string) => `${i}:${jogador}`

export function gerarEventos(dur: number, comWatchdog = false): Evento[] {
  const ids: Svc[] = ['gw', 'me', 're', 'pl']
  const out: Evento[] = []
  let t = 1000
  let ultimo: Svc | null = null
  let i = 0
  while (t < dur - 2500) {
    const opc = ids.filter((x) => x !== ultimo)
    const s = opc[Math.floor(Math.random() * opc.length)]
    out.push({ i: i++, s, at: t, ...(comWatchdog ? { r: WD_MIN + Math.round(Math.random() * (CONSERTO_WD - WD_MIN)) } : {}) })
    ultimo = s
    t += 2200 + Math.floor(Math.random() * 1200)
  }
  return out
}

export const chaveTap = (rodada: 'r1', i: number) => `${rodada}:${i}`

/** Serviços fora do ar no instante `rel` (ms desde o início da rodada). */
export function foraDoAr(modo: 'r1' | 'wd', r: Rodada, taps: Record<string, Tap>, rel: number): Partial<Record<Svc, number>> {
  const out: Partial<Record<Svc, number>> = {}
  for (const e of r.eventos) {
    if (e.at > rel) continue
    if (modo === 'r1') {
      if (!taps[chaveTap('r1', e.i)] && out[e.s] === undefined) out[e.s] = e.at
    } else if (rel < e.at + (e.r ?? CONSERTO_WD)) out[e.s] = e.at
  }
  return out
}

/** Segundos fora do ar somados na rodada, até o instante `rel` (limitado à duração). */
export function segundosFora(modo: 'r1' | 'wd', r: Rodada, taps: Record<string, Tap>, rel: number): number {
  const limite = Math.min(rel, r.dur)
  if (modo === 'wd') {
    return r.eventos.reduce((s, e) => s + Math.max(0, Math.min(limite, e.at + (e.r ?? CONSERTO_WD)) - e.at), 0) / 1000
  }
  const porSvc: Record<string, [number, number][]> = {}
  for (const e of r.eventos) {
    if (e.at > limite) continue
    const tp = taps[chaveTap('r1', e.i)]
    const fim = tp ? Math.min(tp.t - r.t0, limite) : limite
    if (fim > e.at) (porSvc[e.s] ??= []).push([e.at, fim])
  }
  let total = 0
  for (const ints of Object.values(porSvc)) {
    ints.sort((a, b) => a[0] - b[0])
    let [ini, fim] = ints[0]
    for (const [a, b] of ints.slice(1)) {
      if (a <= fim) fim = Math.max(fim, b)
      else {
        total += fim - ini
        ini = a
        fim = b
      }
    }
    total += fim - ini
  }
  return total / 1000
}

export type PlacarWd = { id: string; nome: string; media: number; levantou: number; total: number }

/** Quedas da rodada com Watchdog já ocorridas até o instante `rel`. */
const quedas = (wd: Rodada, rel: number) => wd.eventos.filter((e) => e.at <= Math.min(rel, wd.dur))

/** Média, em ms, do tempo que o Watchdog levou nas quedas já ocorridas. */
export function mediaWatchdog(wd: Rodada, rel: number): number {
  const q = quedas(wd, rel)
  if (!q.length) return CONSERTO_WD
  return q.reduce((s, e) => s + (e.r ?? CONSERTO_WD), 0) / q.length
}

/** Ranking por menor tempo médio de reação. Queda não levantada conta 3 s e cada toque errado soma 0,5 s ao total. */
export function placarReacao(wd: Rodada, reacoes: Record<string, number>, erros: Record<string, number>, jogadores: Jogador[], rel: number): PlacarWd[] {
  const q = quedas(wd, rel)
  if (!q.length) return []
  const out: PlacarWd[] = []
  for (const p of jogadores) {
    let soma = 0
    let levantou = 0
    for (const e of q) {
      const v = reacoes[`${e.i}:${p.id}`]
      if (v === undefined) soma += TETO_REACAO_MS
      else {
        soma += v
        levantou++
      }
    }
    if (levantou === 0) continue
    soma += (erros[p.id] ?? 0) * PENAL_ERRO_MS
    out.push({ id: p.id, nome: p.nome, media: soma / q.length, levantou, total: q.length })
  }
  return out.sort((a, b) => a.media - b.media || b.levantou - a.levantou)
}
