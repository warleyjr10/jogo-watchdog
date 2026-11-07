import { Redis } from '@upstash/redis'

export type Store = {
  modo: 'redis' | 'memoria'
  get(chave: string): Promise<string | null>
  set(chave: string, valor: string): Promise<void>
  hgetall(chave: string): Promise<Record<string, string>>
  hset(chave: string, campo: string, valor: string): Promise<void>
  hdel(chave: string, campos: string[]): Promise<void>
  hsetnx(chave: string, campo: string, valor: string): Promise<boolean>
  hincrby(chave: string, campo: string, n: number): Promise<number>
  del(chave: string): Promise<void>
  expire(chave: string, segundos: number): Promise<void>
}

type Memoria = { hashes: Map<string, Map<string, string>>; textos: Map<string, string> }
const g = globalThis as unknown as { __mem?: Memoria; __store?: Store }

function criar(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (url && token) {
    const r = new Redis({ url, token, automaticDeserialization: false })
    return {
      modo: 'redis',
      async get(chave) {
        const v = await r.get<string>(chave)
        return v ?? null
      },
      async set(chave, valor) {
        await r.set(chave, valor)
      },
      async hgetall(chave) {
        // Com a desserialização automática desligada, o SDK devolve uma lista plana [campo, valor, campo, valor...].
        const v: unknown = await r.hgetall<Record<string, unknown>>(chave)
        const out: Record<string, string> = {}
        if (!v) return out
        if (Array.isArray(v)) {
          for (let i = 0; i + 1 < v.length; i += 2) out[String(v[i])] = String(v[i + 1])
          return out
        }
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = typeof x === 'string' ? x : JSON.stringify(x)
        return out
      },
      async hset(chave, campo, valor) {
        await r.hset(chave, { [campo]: valor })
      },
      async hdel(chave, campos) {
        if (campos.length) await r.hdel(chave, ...campos)
      },
      async hsetnx(chave, campo, valor) {
        return (await r.hsetnx(chave, campo, valor)) === 1
      },
      async hincrby(chave, campo, n) {
        return await r.hincrby(chave, campo, n)
      },
      async del(chave) {
        await r.del(chave)
      },
      async expire(chave, segundos) {
        await r.expire(chave, segundos)
      },
    }
  }
  // Sem Redis configurado: memória local. Serve só para testar no computador.
  const mem: Memoria = (g.__mem ??= { hashes: new Map(), textos: new Map() })
  const h = (c: string) => {
    let m = mem.hashes.get(c)
    if (!m) mem.hashes.set(c, (m = new Map()))
    return m
  }
  return {
    modo: 'memoria',
    async get(chave) {
      return mem.textos.get(chave) ?? null
    },
    async set(chave, valor) {
      mem.textos.set(chave, valor)
    },
    async hgetall(chave) {
      return Object.fromEntries(h(chave))
    },
    async hset(chave, campo, valor) {
      h(chave).set(campo, valor)
    },
    async hdel(chave, campos) {
      const m = h(chave)
      for (const c of campos) m.delete(c)
    },
    async hsetnx(chave, campo, valor) {
      const m = h(chave)
      if (m.has(campo)) return false
      m.set(campo, valor)
      return true
    },
    async hincrby(chave, campo, n) {
      const m = h(chave)
      const novo = Number(m.get(campo) ?? 0) + n
      m.set(campo, String(novo))
      return novo
    },
    async del(chave) {
      mem.hashes.delete(chave)
      mem.textos.delete(chave)
    },
    async expire() {},
  }
}

export function getStore(): Store {
  return (g.__store ??= criar())
}
