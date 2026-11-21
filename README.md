# BATALHA-MOZ

Protótipo 3D single-player de exploração numa ilha inspirada em Moçambique.

## Sistemas implementados
- Ilha 3D procedural com terreno ondulado, montanhas, floresta, rochas e nuvens.
- Ciclo de iluminação e horário.
- Casas, telhados, portas, janelas e caminhos.
- Personagem 3D original com movimento, corrida e salto.
- Sequência cinematográfica de sobrevoo de aeronave e descida com paraquedas dentro do jogo.
- Ecrã inicial e ecrã de carregamento.
- Controlos de teclado, rato e joystick táctil.
- Cinco cristais colecionáveis e interface de missão.

## Executar localmente
```bash
python -m http.server 8000
```
Abre http://localhost:8000.

## Publicação
O repositório está configurado como Render Static Site com publicação automática a partir da branch `main`. O Three.js é carregado por CDN, pelo que o navegador precisa de ligação à internet.

## Controlos
- WASD: mover.
- Shift: correr.
- Espaço: saltar.
- Rato: olhar no computador.
- Joystick esquerdo e arrasto no lado direito no telemóvel.

## Limitações atuais
É um protótipo de exploração single-player, não um jogo comercial completo. Ainda não inclui multiplayer online, matchmaking, servidor dedicado, modelos humanos externos com animação profissional, mapa de grande escala, interiores completos, veículos dirigíveis ou sistema de lobby completo. A sequência de avião e paraquedas é uma animação de jogo, não uma simulação física real.
