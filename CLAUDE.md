# Instruções para o Claude neste repositório

- Fale em português com o Lucas. Ele não é programador: explique em termos simples
  e diga o que ele precisa fazer, se houver algo. Ele prefere que você discorde com franqueza.
- Cripta de Cristal é um jogo de ação cooperativo pelo navegador (tudo original, desenhado por código).
  Usa o MESMO projeto Firebase do Forma Palavras (`caca-palavras-6cd16`), num caminho próprio
  (`cripta/rooms/...`), e só LÊ o apelido do perfil de lá. Não quebre nada do Forma Palavras nem do Pé na Tábua.
- Nunca mexa no Aura Battle (`duels-game`) nem no Firebase dele.
- `main` é o que está no ar: todo push em `main` publica o site no GitHub Pages (pasta `public/`).

## Testar

- `cd public && python3 -m http.server` e abra `index.html`. No computador joga pelo teclado.
- `?auto=1&classe=mago&sexo=f` entra direto numa partida solo; `?debug=1` expõe `window.__cc`.
- Multiplayer sem Firebase: abra `?local=1` em duas abas (banco de teste no próprio navegador).

## Multiplayer

- O anfitrião simula os monstros e publica uma "foto" deles ~10x por segundo (`inimigos`).
  Cada jogador simula o próprio herói, publica o `estado` e manda os `golpes` que acertou.
  Dano no herói, tesouro e bênçãos são calculados em cada celular.
- `database.rules.json` daqui tem as regras do projeto INTEIRO (Forma Palavras + Pé na Tábua + Torre Bamba + Cripta).
  O Firebase só tem um arquivo de regras: ao mudar, mantenha as outras partes iguais e peça pro Lucas
  colar no Console (Realtime Database → Regras). Se outro jogo novo também acrescentou regras,
  junte os blocos — não substitua.
