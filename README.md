# Jogo: Plantão do SMB (Watchdog)

App do congresso COONTROL 2026. Rodada 1: serviços do SMB (Gateway, Medições, Relatórios, PLCCOM) caem e cada pessoa toca no celular para levantar, ganhando mais pontos quem for mais rápido. Depois o host liga o Watchdog: os serviços se recuperam sozinhos e o telão compara os segundos fora do ar.

## Endereços do app

- `/` : tela da plateia (celular).
- `/telao` : telão com a contagem de pessoas online (páginas abertas nos últimos 50 segundos) e os botões do host: Sala de espera, 1. Rodada sem Watchdog, 2. Ligar o Watchdog, 3. Placar final, Reiniciar tudo. Os botões aparecem sem precisar de chave enquanto a variável `HOST_KEY` não existir. Se você criar `HOST_KEY`, passe a abrir `/telao?key=SUA_CHAVE`.
- No canto do telão há o QR code e o link. Clique no link para colar outro endereço. O QR code se atualiza sozinho.
- `/api/v1/health` : mostra se o app está de pé e se o Redis está conectado.

## Como conduzir

1. Abra o telão (`/telao`) e mostre o QR code. As pessoas entram com o nome.
2. Clique em **1. Rodada sem Watchdog**. Há 3 segundos de contagem e a rodada dura 45 segundos.
3. Clique em **2. Ligar o Watchdog**. Contagem de 3 segundos e 30 segundos de jogo, sem ninguém tocar em nada.
4. Clique em **3. Placar final** para mostrar o pódio.
5. **Reiniciar tudo** tira todos os jogadores. **Sala de espera** zera só a pontuação e mantém os jogadores.

## Publicar na Vercel

1. Crie um projeto novo na Vercel apontando para esta pasta (importando de um repositório Git, ou rodando `npx vercel` dentro da pasta).
2. No projeto, abra **Storage** (ou **Marketplace**), escolha **Upstash Redis**, crie e conecte ao projeto. A Vercel preenche sozinha `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. (Opcional) Em **Settings > Environment Variables**, crie `HOST_KEY` com uma senha curta. Com ela, só quem abrir `/telao?key=SUA_CHAVE` controla o jogo. Sem ela, qualquer pessoa que souber o endereço `/telao` consegue.
4. Faça um novo deploy.
5. Abra `/api/v1/health` e confira `"armazenamento":"redis"`. Se aparecer `memoria`, o jogo pode falhar.
6. Ensaie com 2 ou 3 celulares antes do congresso.

## Rodar no computador (teste)

```
npm install
npm run dev
```

Sem Redis configurado, usa a memória do próprio computador (serve só para testar).

## Observações

- O Watchdog do jogo é uma simulação: ele recupera cada serviço em 1,5 segundo (valor ilustrativo). Não é medição do Watchdog real.
- Uso do Redis: o jogo todo fica em um único hash, então cada leitura gasta 1 comando, e o servidor guarda a leitura por 1 segundo. O celular consulta a cada 1 segundo só na rodada sem Watchdog (que exige toque) e a cada 2,5 segundos nas outras fases; o telão consulta a cada 1,5 segundo. Presença é enviada a cada 20 segundos. Abas escondidas ou com a tela apagada param de consultar. Estimativa (não medida em produção): cerca de 10 a 15 mil comandos para 150 pessoas durante 15 minutos. Em teste local com 3 jogadores e o telão, uma rodada completa gastou cerca de 100 comandos. Feche abas antigas de teste antes do evento e confira o consumo no Upstash.
- Na fase com Watchdog o celular só acompanha: o Watchdog levanta os serviços sozinho e ninguém toca.
- Os dados ficam no Redis por 48 horas e a sala aceita até 500 jogadores.
- App temporário de evento: sem login e sem tabelas de negócio. Fora do padrão COONTROL (Next.js + Supabase) por decisão do projeto, usando Redis da Vercel. Se virar app permanente, consultar a TI (software@coontrol.com.br).
