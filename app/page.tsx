'use client'
import { useEffect, useRef, useState } from 'react'
import { useJogo } from '@/lib/useJogo'
import { usePresenca } from '@/lib/usePresenca'
import { SERVICOS, NOME, CONSERTO_WD, PENAL_ERRO_MS, chaveReacao, chaveTap, fmtS, foraDoAr, placarReacao, type Svc, type Tap } from '@/lib/game'

const KEY = 'congresso-jogo-participante'

// Celular: consulta a cada 1 s só durante a rodada em que se toca; nas outras fases, a cada 2,5 s.
const intervaloParticipante = (j: { estado: { estagio: string } } | null) => (j?.estado.estagio === 'r1' || j?.estado.estagio === 'wd' ? 1000 : 2500)

function novoId(): string {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Participante() {
  const [id, setId] = useState('')
  const [nome, setNome] = useState('')
  const [entrou, setEntrou] = useState(false)
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const toastAte = useRef(0)
  const [locais, setLocais] = useState<Record<string, Tap>>({})
  const [locaisWd, setLocaisWd] = useState<Record<string, number>>({})
  const { jogo, agora, recarregar } = useJogo(intervaloParticipante)
  usePresenca(id)

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY)
      if (s) {
        const o = JSON.parse(s) as { id: string; nome: string }
        setId(o.id)
        setNome(o.nome)
        setEntrou(true)
        return
      }
    } catch {
      /* segue sem memória do aparelho */
    }
    setId(novoId())
  }, [])

  // Se o host reiniciou tudo, entra de novo sozinho com o mesmo nome.
  useEffect(() => {
    if (!jogo || !entrou || !id) return
    if (!jogo.jogadores.some((j) => j.id === id))
      fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nome: nome.trim() }) }).then(recarregar)
  }, [jogo, entrou, id, nome, recarregar])

  async function entrar() {
    setMsg('')
    try {
      const r = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nome: nome.trim() }) })
      const j = (await r.json()) as { ok: boolean; erro?: { mensagem: string } }
      if (!j.ok) return setMsg(j.erro?.mensagem ?? 'Não foi possível entrar.')
      try {
        localStorage.setItem(KEY, JSON.stringify({ id, nome: nome.trim() }))
      } catch {
        /* sem armazenamento */
      }
      setEntrou(true)
      recarregar()
    } catch {
      setMsg('Sem conexão. Confira o Wi-Fi e tente de novo.')
    }
  }

  function avisar(t: string) {
    setToast(t)
    toastAte.current = Date.now() + 1800
    setTimeout(() => setToast(''), 1850)
  }

  const t0r1 = jogo?.estado.r1?.t0
  useEffect(() => {
    setLocais({})
  }, [t0r1])
  const t0wd = jogo?.estado.wd?.t0
  useEffect(() => {
    setLocaisWd({})
  }, [t0wd])

  // Marca na hora, só neste celular, o serviço que acabou de ser levantado (o servidor confirma na próxima consulta).
  function marcarLocal(s: Svc) {
    const r = jogo?.estado.r1
    if (!jogo || !r) return
    const rel = agora() - r.t0
    const novos: Record<string, Tap> = {}
    for (const e of r.eventos) {
      const k = chaveTap('r1', e.i)
      if (e.s === s && e.at <= rel && !jogo.taps[k]) novos[k] = { p: id, t: agora(), pts: 0 }
    }
    setLocais((p) => ({ ...p, ...novos }))
  }

  async function tocar(s: Svc) {
    try {
      const r = await fetch('/api/tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, s }) })
      const j = (await r.json()) as { ok: boolean; data?: { resultado: string; pts?: number; ms?: number } }
      const res = j.data?.resultado
      if (!j.ok) avisar('Não deu certo, toque de novo')
      else if (res === 'ok') {
        marcarLocal(s)
        avisar(`+${j.data?.pts}! ${NOME[s]} de volta`)
      }
      else if (res === 'wd') {
        const ms = j.data?.ms ?? 0
        const w = jogo?.estado.wd
        let wdMs = CONSERTO_WD
        if (w) {
          const rel = agora() - w.t0
          const e = w.eventos.find((x) => x.s === s && x.at <= rel && !locaisWd[chaveReacao(x.i, id)] && jogo?.reacoes[chaveReacao(x.i, id)] === undefined)
          if (e) {
            wdMs = e.r ?? CONSERTO_WD
            setLocaisWd((p) => ({ ...p, [chaveReacao(e.i, id)]: ms }))
          }
        }
        avisar(`Você: ${fmtS(ms)} s. Watchdog: ${fmtS(wdMs, 2)} s`)
      } else if (res === 'erro-wd') avisar(`Esse serviço está no ar: +${fmtS(PENAL_ERRO_MS)} s de penalidade`)
      else if (res === 'penal') avisar('-5: esse serviço está no ar')
      else if (res === 'perdeu') {
        marcarLocal(s)
        avisar('Outra pessoa foi mais rápida')
      }
      recarregar()
    } catch {
      avisar('Sem conexão')
    }
  }

  const logo = <img className="logo" src="/logo.png" alt="COONTROL" />

  if (!entrou)
    return (
      <main className="pg">
        {logo}
        <h2>Plantão do SMB</h2>
        <p className="s">Escreva seu nome para entrar no jogo. Quem for mais rápido para levantar os serviços ganha mais pontos.</p>
        <div className="grow" />
        {msg && <div className="erro">{msg}</div>}
        <input className="txt" maxLength={20} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button className="btn" disabled={!nome.trim() || !id} onClick={entrar}>
          Entrar
        </button>
      </main>
    )

  const eu = jogo?.jogadores.find((j) => j.id === id)
  const pontos = eu?.pontos ?? 0
  const cab = (
    <>
      {logo}
      <div className="pill">
        <span>{nome}</span>
        <span>{pontos} pts</span>
      </div>
    </>
  )

  if (!jogo)
    return (
      <main className="pg">
        {cab}
        <div className="grow" />
        <p className="s">Conectando...</p>
        <div className="grow" />
      </main>
    )

  const { estado } = jogo
  const t = agora()

  if (estado.estagio === 'r1' && estado.r1) {
    const rel = t - estado.r1.t0
    if (rel < 0)
      return (
        <main className="pg">
          {cab}
          <div className="grow" />
          <h2>Prepare o dedo</h2>
          <div className="cont">{Math.ceil(-rel / 1000)}</div>
          <div className="grow" />
        </main>
      )
    if (rel <= estado.r1.dur) {
      const fora = foraDoAr('r1', estado.r1, { ...locais, ...jogo.taps }, rel)
      return (
        <main className="pg">
          {cab}
          <h2>Levante os serviços</h2>
          <p className="s">Toque no serviço vermelho para levantar. Quem for mais rápido ganha mais pontos. Tocar em serviço no ar tira 5.</p>
          <div className="pill">
            <span>Tempo</span>
            <b>{Math.max(0, Math.ceil((estado.r1.dur - rel) / 1000))} s</b>
          </div>
          <div className="grid2">
            {SERVICOS.map((s) => {
              const down = fora[s.id] !== undefined
              return (
                <button key={s.id} className={`sv ${down ? 'down' : 'ok'}`} onClick={() => tocar(s.id)}>
                  <strong>{s.n}</strong>
                  <span>{down ? 'CAIU: toque para levantar' : 'No ar'}</span>
                </button>
              )
            })}
          </div>
          <div className="toast">{toast}</div>
        </main>
      )
    }
    return (
      <main className="pg">
        {cab}
        <div className="grow" />
        <h2>Rodada encerrada</h2>
        <p className="s">
          Você fez <b>{pontos} pontos</b>. Repare como foi cansativo vigiar tudo na mão. Aguarde.
        </p>
        <div className="grow" />
      </main>
    )
  }

  if (estado.estagio === 'wd' && estado.wd) {
    const relw = t - estado.wd.t0
    // Aqui o celular mostra o ponto de vista de quem vigia na mão: o serviço fica vermelho até a pessoa tocar.
    // O telão mostra o Watchdog, que levanta tudo em uma fração de segundo.
    const foraw: Partial<Record<Svc, number>> = {}
    if (relw >= 0)
      for (const e of estado.wd.eventos) {
        if (e.at > relw) continue
        const k = chaveReacao(e.i, id)
        if (locaisWd[k] === undefined && jogo.reacoes[k] === undefined && foraw[e.s] === undefined) foraw[e.s] = e.at
      }
    return (
      <main className="pg">
        {cab}
        <h2>Agora com Watchdog</h2>
        <p className="s">Tente levantar os serviços na mão como antes. Olhe o telão: o Watchdog levanta sozinho em até {fmtS(CONSERTO_WD, 2)} s. Vale o menor tempo médio de reação: não toque em serviço no ar (+{fmtS(PENAL_ERRO_MS)} s).</p>
        <div className="pill">
          <span>Tempo</span>
          <b>{Math.max(0, Math.ceil((estado.wd.dur - relw) / 1000))} s</b>
        </div>
        <div className="grid2">
          {SERVICOS.map((s) => {
            const down = foraw[s.id] !== undefined
            return (
              <button key={s.id} className={`sv ${down ? 'down' : 'ok'}`} onClick={() => tocar(s.id)}>
                <strong>{s.n}</strong>
                <span>{down ? 'CAIU: toque para levantar' : 'No ar'}</span>
              </button>
            )
          })}
        </div>
        <div className="toast">{toast}</div>
      </main>
    )
  }

  if (estado.estagio === 'end') {
    const ordem = [...jogo.jogadores].sort((a, b) => b.pontos - a.pontos)
    const pos = ordem.findIndex((j) => j.id === id) + 1
    const reac = estado.wd ? placarReacao(estado.wd, jogo.reacoes, jogo.erros, jogo.jogadores, estado.wd.dur) : []
    const posR = reac.findIndex((j) => j.id === id) + 1
    const minha = reac.find((j) => j.id === id)
    return (
      <main className="pg">
        {cab}
        <div className="grow" />
        <h2>{pos ? `Você ficou em ${pos}º` : 'Fim de jogo'}</h2>
        <p className="s">
          Com {pontos} pontos.{minha ? ` Reação média de ${fmtS(minha.media)} s, ${posR}º no tempo de reação.` : ''} Obrigado por jogar!
        </p>
        <div className="grow" />
      </main>
    )
  }

  return (
    <main className="pg">
      {cab}
      <div className="grow" />
      <h2>Você está dentro</h2>
      <p className="s">Aguarde o host iniciar. Olhe para o telão.</p>
      <div className="grow" />
    </main>
  )
}
