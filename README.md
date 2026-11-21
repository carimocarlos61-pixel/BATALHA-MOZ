# BATALHA-MOZ

Protótipo 3D de exploração e sobrevivência em navegador, passado numa ilha inspirada em Moçambique.

## Funcionalidades atuais
- Mundo 3D procedural com terreno ondulado, montanhas, árvores, rochas e nuvens.
- Personagem 3D original de blocos geométricos.
- Câmara em terceira pessoa com controlo do rato.
- Movimento WASD, corrida e salto.
- Cinco cristais colecionáveis e interface de missão.
- Ciclo de luz/horário e ambiente atmosférico.
- Interface responsiva; controlos tácteis para telemóvel ainda por implementar.

## Executar localmente
Sirva a pasta por HTTP (módulos JavaScript não funcionam de forma fiável abrindo o HTML como ficheiro):

```bash
python -m http.server 8000
```

Abra http://localhost:8000.

## Publicação na Render
O ficheiro `render.yaml` configura um Static Site. Ligue este repositório à Render e aplique o Blueprint. O jogo é um protótipo de frontend; não inclui servidor multiplayer, contas, matchmaking ou sincronização entre jogadores.

## Controlos
- W A S D: mover
- Shift: correr
- Espaço: saltar
- Rato: olhar (clique no mundo para capturar o rato)
- Esc: libertar o rato

## Estado
Protótipo inicial. A qualidade visual depende do desempenho do dispositivo e da disponibilidade do CDN Three.js. Não representa um produto final nem um jogo multiplayer completo.
