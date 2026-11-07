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
/** Tempo que o Watchdog leva para recuperar um serviço (valor ilustrativo da brincadeira, bem mais rápido que uma pessoa). */
export const CONSERTO_WD = 250
export const CONTAGEM = 3_000

export type Evento = { i: number; s: Svc; at: number }
export type Rodada = { t0: number; dur: number; eventos: Evento[] }
export type Estagio = 'lobby' | 'r1' | 'wd' | 'end'
export type Estado = { estagio: Estagio; r1?: Rodada; wd?: Rodada }
export type Tap = { p: string; t: number; pts: number }
export type Jogador = { id: string; nome: string; pontos: number }
export type Jogo = { agora: number; estado: Estado; jogadores: Jogador[]; taps: Record<string, Tap>; reacoes: Record<string, number>; armazenamento: string; online: number; hostLivre: boolean }

/** Chave do tempo de reação de um jogador a uma queda na rodada com Watchdog (valor em ms). */
export const chaveReacao = (i: number, jogador: string) => `${i}:${jogador}`

export function gerarEventos(dur: number): Evento[] {
  const ids: Svc[] = ['gw', 'me', 're', 'pl']
  const out: Evento[] = []
  let t = 1000
  let ultimo: Svc | null = null
  let i = 0
  while (t < dur - 2500) {
    const opc = ids.filter((x) => x !== ultimo)
    const s = opc[Math.floor(Math.random() * opc.length)]
    out.push({ i: i++, s, at: t })
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
    } else if (rel < e.at + CONSERTO_WD) out[e.s] = e.at
  }
  return out
}

/** Segundos fora do ar somados na rodada, até o instante `rel` (limitado à duração). */
export function segundosFora(modo: 'r1' | 'wd', r: Rodada, taps: Record<string, Tap>, rel: number): number {
  const limite = Math.min(rel, r.dur)
  if (modo === 'wd') {
    return r.eventos.reduce((s, e) => s + Math.max(0, Math.min(limite, e.at + CONSERTO_WD) - e.at), 0) / 1000
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
