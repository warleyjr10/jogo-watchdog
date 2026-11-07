'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import LinkQR from '@/components/Link'
import { useJogo } from '@/lib/useJogo'
import { SERVICOS, NOME, CONTAGEM, chaveTap, fmtS, foraDoAr, mediaWatchdog, placarReacao, segundosFora, CONSERTO_WD, WD_MIN, TETO_REACAO_MS, PENAL_ERRO_MS, type Jogo, type Jogador, type PlacarWd } from '@/lib/game'

function RankingReacao({ lista, wdMedia }: { lista: PlacarWd[]; wdMedia: number }) {
  const r = lista.slice(0, 5)
  const melhor = Math.min(wdMedia, r[0]?.media ?? wdMedia)
  return (
    <div className="rk">
      <h3>Reação média</h3>
      <div>
        <p>
          <span>Watchdog</span>
          <b>{fmtS(wdMedia, 2)} s</b>
        </p>
        <div className="b">
          <i style={{ width: `${(melhor / wdMedia) * 100}%` }} />
        </div>
      </div>
      {r.length === 0 && <div>Aguardando os primeiros toques</div>}
      {r.map((p) => (
        <div key={p.id}>
          <p>
            <span>{p.nome}</span>
            <b>{fmtS(p.media)} s</b>
          </p>
          <div className="b">
            <i style={{ width: `${(melhor / p.media) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

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
  let ranking: 'pontos' | 'reacao' | null = 'pontos'
  let listaR: PlacarWd[] = []
  let wdMedia = CONSERTO_WD

  if (jogo) {
    const j: Jogo = jogo
    const nj = j.jogadores.length
    const { estado } = j
    if (estado.wd) {
      const relw = t - estado.wd.t0
      listaR = placarReacao(estado.wd, j.reacoes ?? {}, j.erros ?? {}, j.jogadores, relw)
      wdMedia = mediaWatchdog(estado.wd, relw)
    }
    if (estado.estagio === 'wd') ranking = 'reacao'
    if (estado.estagio === 'end') ranking = null
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
          .flatMap((e) => [{ t: e.at, s: `${NOME[e.s]} caiu` }, ...(rel >= e.at + (e.r ?? CONSERTO_WD) ? [{ t: e.at + (e.r ?? CONSERTO_WD), s: `Watchdog recuperou ${NOME[e.s]} em ${fmtS(e.r ?? CONSERTO_WD, 2)} s` }] : [])])
          .sort((a, b) => b.t - a.t)
          .slice(0, 5)
          .map((x) => x.s)
      }
      const r1 = estado.r1
      const s1 = r1 ? Math.round(segundosFora('r1', r1, j.taps, t - r1.t0)) : 0
      const s2 = estado.wd ? Math.round(segundosFora('wd', estado.wd, j.taps, t - estado.wd.t0)) : 0
      // Comparação justa: as rodadas têm durações diferentes, então o destaque é a porcentagem do tempo fora do ar.
      const dur1 = r1 ? Math.max(1, Math.min(t - r1.t0, r1.dur)) : 1
      const durw = estado.wd ? Math.max(1, Math.min(t - estado.wd.t0, estado.wd.dur)) : 1
      const p1 = r1 ? Math.round((segundosFora('r1', r1, j.taps, t - r1.t0) * 1000 * 100) / dur1) : 0
      const p2 = estado.wd ? Math.round((segundosFora('wd', estado.wd, j.taps, t - estado.wd.t0) * 1000 * 100) / durw) : 0
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
                <b>{p1}%</b>
                <em>do tempo fora do ar ({s1} s em {Math.round(r1.dur / 1000)} s de jogo)</em>
              </div>
            )}
            {modo === 'wd' && estado.wd && (
              <div className="num">
                <small>Com Watchdog</small>
                <b>{p2}%</b>
                <em>do tempo fora do ar ({s2} s em {Math.round(estado.wd.dur / 1000)} s de jogo)</em>
              </div>
            )}
            {modo === 'wd' && (
              <div className="num">
                <small>Tempo para levantar uma queda</small>
                <b>{fmtS(wdMedia, 2)} s</b>
                <em>
                  Watchdog, em média (cada queda leva de {fmtS(WD_MIN, 2)} a {fmtS(CONSERTO_WD, 2)} s).{' '}
                  {listaR[0] ? `Melhor humano: ${fmtS(listaR[0].media)} s (${listaR[0].nome}).` : 'Humanos: aguardando toques'}
                </em>
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
          <div className="duas">
            <div>
              <h3>Mais pontos (rodada sem Watchdog)</h3>
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
            <div>
              <h3>Menor tempo médio de reação (rodada com Watchdog)</h3>
              <div className="pod">
                {[1, 0, 2].map((i) =>
                  listaR[i] ? (
                    <div key={listaR[i].id} className={`p${i + 1}`}>
                      <b>{i + 1}º</b>
                      <span>{listaR[i].nome}</span>
                      <em>{fmtS(listaR[i].media)} s</em>
                    </div>
                  ) : null,
                )}
              </div>
              <p className="ref">Watchdog: {fmtS(wdMedia, 2)} s em média. Tempo de quem não levantou a queda conta {fmtS(TETO_REACAO_MS)} s, e cada toque errado soma {fmtS(PENAL_ERRO_MS)} s.</p>
            </div>
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
      <div className="wb" style={ranking === null ? { gridTemplateColumns: '1fr' } : undefined}>
        {corpo}
        {ranking === 'pontos' && jogo && <Ranking jogadores={jogo.jogadores} />}
        {ranking === 'reacao' && jogo && <RankingReacao lista={listaR} wdMedia={wdMedia} />}
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
