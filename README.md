# BATALHA-MOZ

Protótipo 3D single-player de exploração e combate arcade em navegador, passado numa ilha inspirada em Moçambique.

## Sistemas já implementados
- Ilha 3D procedural com terreno ondulado, montanhas, floresta, rochas e nuvens.
- Ciclo de iluminação e horário.
- Casas com paredes, telhados, portas, janelas e pequenos caminhos.
- Personagem 3D original, câmara em terceira pessoa, corrida e salto.
- Controlos de teclado e rato no computador.
- Joystick táctil, câmara por arrasto no lado direito, salto e disparo no telemóvel.
- Projécteis de energia fictícios para treino arcade.
- Seis alvos robóticos com pontos de resistência e contagem de alvos desativados.
- Cinco cristais colecionáveis e interface de missão.

## Executar localmente
```bash
python -m http.server 8000
```
Abre http://localhost:8000.

## Publicação
O repositório está configurado como Render Static Site com publicação automática a partir da branch `main`. O Three.js é carregado por CDN, pelo que o navegador precisa de ligação à internet.

## Controlos
### Computador
- WASD: mover.
- Shift: correr.
- Espaço: saltar.
- Rato: olhar.
- Clique esquerdo: disparar energia.

### Telemóvel
- Joystick esquerdo: mover.
- Arrastar o lado direito do ecrã: olhar.
- Botão Saltar.
- Botão Disparar.

## Estado e limitações
Esta é uma versão de protótipo jogável, não um jogo comercial completo. O combate é arcade e usa energia fictícia e alvos robóticos. Ainda não inclui multiplayer online, contas, matchmaking, mapa de batalha em larga escala, personagens com animações profissionais, inventário de equipamento, sistema de lobby completo, veículos ou servidor de jogo. A aparência e desempenho variam com o dispositivo.
