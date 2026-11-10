# Pulso

Rack de sintetizadores semi-modulares que corre no browser, com patch bay de cabos virtuais. Cada módulo segue a arquitetura de um instrumento semi-modular da Moog (os mesmos tipos de controlo, o mesmo fluxo de sinal, pontos de patch equivalentes). O nome, o aspeto visual e o código são originais. Este projeto não tem qualquer ligação à Moog Music.

Site: https://chicomaria.github.io/SYNTH/

## Módulos

| Módulo | Arquitetura | Resumo |
| --- | --- | --- |
| Pulso M | Mother-32 | 1 VCO serra/pulso, filtro ladder LP/HP, EG, LFO, sequenciador até 32 passos, 32 pontos de patch |
| Pulso D | DFAM | 2 VCOs com FM e hard sync, ruído, 3 envelopes de decay, sequenciador de 8 passos, 24 pontos de patch |
| Pulso S | Subharmonicon | 2 VCOs com 2 sub-harmónicos cada, 2 sequenciadores de 4 passos, 4 geradores de ritmo, quantização |
| Pulso L | Labyrinth | VCO sinusoidal com FM, wavefolder, filtro LP/BP, 2 sequenciadores generativos de 8 bits com "corrupt" |
| Pulso X | Spectravox | Banco de 10 filtros com spectral shift e LFO, modo vocoder com entrada de programa |

## Rack

- **Adicionar, remover, minimizar:** podes ter várias instâncias do mesmo módulo. Minimizado, o módulo mostra só o patch bay.
- **Cabos:** toca numa saída e depois numa entrada de qualquer módulo. Vários cabos na mesma entrada somam-se. Toca numa entrada ligada para tirar o último cabo.
- **Aleatório:** patch, sequência e knobs, para todo o rack (barra de topo) ou por módulo.
- **Zoom:** botões − e + na barra de topo.
- **Mixer:** no topo do rack, um canal por módulo com LEVEL, PAN e FX SEND, mais o delay, o reverb e o MASTER.
- **Visual:** menu com skins (Pulso, Clássico, Funky, Anos 70, Aleatório), estilo dos knobs (arco, clássico, aleatório) e layout (Original, com os controlos em linhas pela ordem do painel do hardware, ou Compacto).
- **Banco de patches:** guarda o rack atual com um nome (módulos, knobs, sequências, cabos, mixer e efeitos), carrega, substitui ou apaga. O banco fica no browser e pode ser exportado e importado como ficheiro `.json`.
- Osciloscópio global. O estado fica guardado no browser. Instalável como app (PWA).

## Diferenças conhecidas em relação ao hardware

- O som é um modelo digital, não uma emulação ao nível do circuito.
- Pulso L e Pulso X foram feitos a partir da arquitetura geral desses instrumentos. Os controlos e os pontos de patch não foram conferidos um a um com os manuais.
- Pulso X não tem entrada de microfone: o programa do vocoder vem de um cabo (por exemplo, a saída VCA de outro módulo).
- Pulso M: o sequenciador guarda nota e pausa por passo (sem acento, ratchet, swing, nem os 64 padrões). A saída ASSIGN envia sempre o relógio de passos.
- Pulso S: quantização só em 12-ET; sem modos de afinação justa.
- Não há MIDI.

## Correr localmente

Não há dependências nem build. Basta servir a pasta:

```sh
python3 -m http.server 8000
# abre http://localhost:8000
```

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `js/worklet.js` | Motor de som: uma classe por tipo de módulo e a matriz de patch (AudioWorklet) |
| `js/defs.js` | Controlos e pontos de patch de cada tipo, memórias e aleatório |
| `js/app.js` | Interface do rack |
| `js/engine.js` | Ligação do worklet aos efeitos e à saída |
| `js/knob.js`, `js/scope.js` | Knob e osciloscópio |
| `sw.js`, `manifest.webmanifest` | Instalação como app e modo offline |

## Publicar

O site é servido a partir do ramo `gh-pages`:

```sh
git push origin main && git push origin main:gh-pages
```
