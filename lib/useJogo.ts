'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Jogo } from '@/lib/game'

/**
 * Consulta o jogo e devolve a hora do servidor (corrigindo diferença de relógio do aparelho).
 * O intervalo muda conforme o estado do jogo e a consulta pausa quando a aba está escondida,
 * para não gastar comandos do Redis à toa.
 */
export function useJogo(intervaloPara: (j: Jogo | null) => number) {
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [, setTick] = useState(0)
  const dif = useRef(0)
  const ref = useRef<Jogo | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const antes = Date.now()
      const r = await fetch('/api/game', { cache: 'no-store' })
      const depois = Date.now()
      const j = (await r.json()) as { ok: boolean; data: Jogo }
      if (!j.ok) return
      dif.current = j.data.agora - (antes + depois) / 2
      ref.current = j.data
      setJogo(j.data)
    } catch {
      /* mantém o último estado */
    }
  }, [])

  useEffect(() => {
    let vivo = true
    let t: ReturnType<typeof setTimeout>
    const ciclo = async () => {
      if (!document.hidden) await recarregar()
      if (vivo) t = setTimeout(ciclo, intervaloPara(ref.current))
    }
    ciclo()
    const b = setInterval(() => setTick((x) => x + 1), 250)
    return () => {
      vivo = false
      clearTimeout(t)
      clearInterval(b)
    }
  }, [recarregar, intervaloPara])

  const agora = () => Date.now() + dif.current
  return { jogo, agora, recarregar }
}
