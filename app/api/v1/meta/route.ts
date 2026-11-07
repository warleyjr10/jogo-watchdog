import { ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

export function GET() {
  return ok({
    app: process.env.NEXT_PUBLIC_APP_NOME ?? 'congresso-jogo-watchdog',
    area: 'evento',
    versao: '1.0.0',
    observacao: 'App temporário do congresso COONTROL 2026. Guarda dados só no Redis, sem tabelas de negócio.',
    recursos: [
      { nome: 'game', rota: '/api/game', metodos: ['GET'] },
      { nome: 'join', rota: '/api/join', metodos: ['POST'] },
      { nome: 'tap', rota: '/api/tap', metodos: ['POST'] },
      { nome: 'host', rota: '/api/host', metodos: ['POST'] },
    ],
  })
}
