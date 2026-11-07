'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import LinkQR from '@/components/Link'
import { useJogo } from '@/lib/useJogo'
import { SERVICOS, NOME, CONTAGEM, chaveTap, foraDoAr, segundosFora, CONSERTO_WD, type Jogo, type Jogador } from '@/lib/game'

function Ranking({ jogadores }: { jogadores: Jogador[] }) {
  const r = [...jogadores].sort((a, b) => b.pontos - a.pontos).slice(0, 5)
  const max = Math.max(1, r[0]?.pontos ?? 1)
  return (
    <div className="rk">
      <h3>Placar</h3>
      {r.length === 0 && <div>Ninguém entrou ainda</div>}
      {r.map((p) => (
        <div key={p.id}>
          <p>
            <span>{p.nome}</span>
            <b>{p.pontos}</b>
          </p>
          <div className="b">
            <i style={{ width: `${(p.pontos / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const intervaloTelao = () => 1500

function Telao() {
  const chave = useSearchParams().get('key') ?? ''
  const { jogo, agora, recarregar } = useJogo(intervaloTelao)
  const host = chave !== '' || jogo?.hostLivre === true
  const [erro, setErro] = useState('')

  async function acao(a: 'lobby' | 'r1' | 'wd' | 'end' | 'reset') {
    if (a === 'reset' && !confirm('Reiniciar tudo e tirar todos os jogadores?')) return
    setErro('')
    const r = await fetch('/api/host', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: a, key: chave }) })
    const j = (await r.json()) as { ok: boolean; erro?: { mensagem: string } }
    if (!j.ok) setErro(j.erro?.mensagem ?? 'Erro')
    recarregar()
  }

  const semRedis = jogo?.armazenamento === 'memoria' && typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  const t = agora()
  let titulo = 'Plantão do SMB'
  let sub = ''
  let corpo: React.ReactNode = null
  const ranking = true

  if (jogo) {
    const j: Jogo = jogo
    const nj = j.jogadores.length
    const { estado } = j
    if (estado.estagio === 'lobby') {
      sub = `${nj} ${nj === 1 ? 'jogador' : 'jogadores'} na sala`
      corpo = (
        <div className="main">
          <div className="symw">Entre pelo QR code e escreva seu nome. O jogo já vai começar.</div>
          <div className="feed">{j.jogadores.map((p) => p.nome).join(' · ')}</div>
        </div>
      )
    } else if ((estado.estagio === 'r1' && estado.r1) || (estado.estagio === 'wd' && estado.wd)) {
      const modo = estado.estagio === 'r1' ? 'r1' : 'wd'
      const r = (modo === 'r1' ? estado.r1 : estado.wd)!
      const rel = t - r.t0
      const comeca = rel < 0
      const fim = rel > r.dur
      titulo = modo === 'r1' ? 'Rodada 1: sem Watchdog' : 'Agora com Watchdog'
      sub = comeca ? 'Preparar' : fim ? 'Rodada encerrada' : `${Math.max(0, Math.ceil((r.dur - rel) / 1000))} s restantes`
      const fora = foraDoAr(modo, r, j.taps, Math.max(0, rel))
      const nomes = new Map(j.jogadores.map((p) => [p.id, p.nome]))
      let feed: string[] = []
      if (modo === 'r1') {
        feed = r.eventos
          .filter((e) => e.at <= rel)
          .flatMap((e) => {
            const tp = j.taps[chaveTap('r1', e.i)]
            return [{ t: r.t0 + e.at, s: `${NOME[e.s]} caiu` }, ...(tp && tp.pts > 0 ? [{ t: tp.t, s: `${nomes.get(tp.p) ?? 'Alguém'} levantou ${NOME[e.s]} (+${tp.pts})` }] : [])]
          })
          .sort((a, b) => b.t - a.t)
          .slice(0, 5)
          .map((x) => x.s)
      } else {
        feed = r.eventos
          .filter((e) => e.at <= rel)
          .flatMap((e) => [{ t: e.at, s: `${NOME[e.s]} caiu` }, ...(rel >= e.at + CONSERTO_WD ? [{ t: e.at + CONSERTO_WD, s: `Watchdog recuperou ${NOME[e.s]} sozinho` }] : [])])
          .sort((a, b) => b.t - a.t)
          .slice(0, 5)
          .map((x) => x.s)
      }
      const r1 = estado.r1
      const s1 = r1 ? Math.round(segundosFora('r1', r1, j.taps, t - r1.t0)) : 0
      const s2 = estado.wd ? Math.round(segundosFora('wd', estado.wd, j.taps, t - estado.wd.t0)) : 0
      corpo = (
        <div className="main">
          {comeca ? (
            <div className="symw">Prepare-se: começa em {Math.max(1, Math.ceil(-rel / 1000))}...</div>
          ) : (
            <div className="svs">
              {SERVICOS.map((s) => {
                const down = fora[s.id] !== undefined
                return (
                  <div key={s.id} className={`st ${down ? 'down' : 'ok'}`}>
                    <strong>{s.n}</strong>
                    <span>{down ? `Fora do ar há ${Math.max(0, Math.round((rel - (fora[s.id] ?? 0)) / 1000))} s` : 'No ar'}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="big">
            {r1 && (
              <div className="num">
                <small>Sem Watchdog</small>
                <b>{s1}</b>
                <em>s fora do ar em {Math.round(r1.dur / 1000)} s de jogo</em>
              </div>
            )}
            {modo === 'wd' && estado.wd && (
              <div className="num">
                <small>Com Watchdog</small>
                <b>{s2}</b>
                <em>s fora do ar em {Math.round(estado.wd.dur / 1000)} s de jogo</em>
              </div>
            )}
          </div>
          <div className="feed">{feed.length ? feed.map((f, i) => <div key={`${f}${i}`}>{f}</div>) : 'Aguardando as primeiras quedas'}</div>
        </div>
      )
    } else {
      const r = [...j.jogadores].sort((a, b) => b.pontos - a.pontos)
      titulo = 'Placar final'
      sub = 'Obrigado por jogar'
      corpo = (
        <div className="main">
          <div className="pod">
            {[1, 0, 2].map((i) =>
              r[i] ? (
                <div key={r[i].id} className={`p${i + 1}`}>
                  <b>{i + 1}º</b>
                  <span>{r[i].nome}</span>
                  <em>{r[i].pontos} pts</em>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )
    }
  } else {
    sub = 'Conectando...'
  }

  return (
    <div className="wall">
      <div className="wh">
        <div>
          <h1>{titulo}</h1>
          <div className="c">
            {sub}
            {jogo ? ` · ${jogo.online} ${jogo.online === 1 ? 'pessoa online' : 'pessoas online'}` : ''}
          </div>
        </div>
        <LinkQR />
      </div>
      {semRedis && <div className="aviso">Redis não configurado: o jogo fica só na memória do servidor e pode falhar. Conecte o Redis no projeto da Vercel.</div>}
      {erro && <div className="aviso">{erro}</div>}
      <div className="wb">
        {corpo}
        {ranking && jogo && <Ranking jogadores={jogo.jogadores} />}
      </div>
      {host && (
        <div className="hostbar">
          <button onClick={() => acao('lobby')}>Sala de espera</button>
          <button className="p" onClick={() => acao('r1')}>
            1. Rodada sem Watchdog
          </button>
          <button className="p" onClick={() => acao('wd')}>
            2. Ligar o Watchdog
          </button>
          <button className="p" onClick={() => acao('end')}>
            3. Placar final
          </button>
          <button onClick={() => acao('reset')}>Reiniciar tudo</button>
          <span style={{ fontSize: 13, opacity: 0.7 }}>A rodada começa {CONTAGEM / 1000} s depois do clique.</span>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Telao />
    </Suspense>
  )
}
