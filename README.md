# Cripta de Cristal

Aventura de ação em masmorras (estilo "roguelite": cada partida é diferente), com desenho liso
(sem pixel art) e clima medieval de cristal. Dá pra jogar sozinho ou com até 4 pessoas, cada uma
no seu celular (salas com código de 4 letras).

- **6 heróis**, todos com versão homem e mulher: Cavaleiro, Mago, Vampiro, Lobisomem, Monge e Padre.
  Cada um tem um combo de ataque e uma habilidade própria.
- **3 andares + chefe** (Guardião do Prisma). Depois do chefe dá pra continuar descendo, mais difícil.
- Entre os andares, cada jogador escolhe uma **bênção** no altar e pode gastar cristais em frascos de poção.
- Com amigos: quem cai fica no chão até alguém ficar perto por 2 segundos (ou o Padre usar a Luz Sagrada).

## Controles

- Celular (deitado): polegar esquerdo arrasta pra andar; botões ▲ pular, ⚔ atacar, ⟳ rolar, habilidade e 🧪 poção.
- Computador: ← → (ou A D) andar, Espaço pular, J atacar, K habilidade, L/Shift rolar, Q poção, Esc pausa.

| Arquivo | O que é |
| --- | --- |
| `public/index.html`, `public/style.css` | Telas e botões |
| `public/js/jogo.js` | Laço do jogo, combate do herói, telas, multiplayer |
| `public/js/herois.js` | Números de cada classe e o desenho dos heróis (homem/mulher) |
| `public/js/inimigos.js` | Monstros e chefe: números, inteligência e desenho |
| `public/js/nivel.js` | Gerador de fases (mesma semente = mesma fase pra todo mundo) |
| `public/js/arte.js` | Fundo, blocos, cristais, portal |
| `public/js/fisica.js` | Movimento e colisão |
| `public/js/controles.js` | Teclado e toque |
| `public/js/som.js` | Sons e música (gerados na hora) |
| `public/js/rede.js` | Salas no Firebase (`cripta/rooms/...`) |
