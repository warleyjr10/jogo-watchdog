'use client'
import { useEffect } from 'react'

/** Avisa o servidor a cada 20 segundos que este aparelho está com a página aberta e visível. */
export function usePresenca(id: string) {
  useEffect(() => {
    if (!id) return
    const bater = () => {
      if (document.hidden) return
      fetch('/api/presenca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {})
    }
    bater()
    const t = setInterval(bater, 20_000)
    document.addEventListener('visibilitychange', bater)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', bater)
    }
  }, [id])
}
