# Pulso

Dois sintetizadores semi-modulares que correm no browser, com patch bay de cabos virtuais. A arquitetura segue a de dois instrumentos analógicos clássicos, o Moog Mother-32 (unidade melódica) e o Moog DFAM (unidade de percussão): os mesmos controlos, o mesmo fluxo de sinal e os mesmos pontos de patch. O nome, o aspeto visual e o código são originais. Este projeto não tem qualquer ligação à Moog Music.

## Pulso M (melódico)

- 1 oscilador (serra ou pulso, com largura de pulso), ruído, MIX.
- Filtro ladder de 4 polos, passa-baixo ou passa-alto, com ressonância auto-oscilante.
- Envelope (attack, decay, sustain on/off), LFO (triangular ou quadrada), glide.
- Modulação do VCO (fonte EG/LFO, destino largura de pulso ou frequência) e do filtro (fonte, quantidade, polaridade).
- VCA em modo EG ou ON.
- Sequenciador de até 32 passos, programado com um teclado de 13 botões.
- Patch bay de 32 pontos.

## Pulso D (percussão)

- 2 osciladores (triangular ou quadrada) com FM 1→2 e hard sync.
- Ruído, filtro ladder passa-baixo ou passa-alto.
- Três envelopes de decay (VCO, VCF, VCA), com quantidades bipolares.
- Sequenciador de 8 passos com afinação e velocidade por passo.
- Patch bay de 24 pontos.

## Patch bay

Toca numa saída e depois numa entrada para ligar um cabo. Toca numa entrada ligada para o tirar. Os cabos podem ligar as duas unidades entre si. Por exemplo, `ASSIGN` (relógio de passos do Pulso M) para `ADV/CLOCK` do Pulso D põe as duas em sincronia.

## Diferenças conhecidas em relação ao hardware

- A saída `ASSIGN` envia sempre o relógio de passos (no hardware é configurável).
- O sequenciador do Pulso M guarda nota e pausa por passo. Não tem acento, ratchet, swing nem os 64 padrões em memória.
- Tempo e gate length são dois knobs separados.
- Não há MIDI.
- O som é um modelo digital, não uma emulação ao nível do circuito.

## Correr localmente

Não há dependências nem build. Basta servir a pasta:

```sh
python3 -m http.server 8000
# abre http://localhost:8000
```

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `js/worklet.js` | Motor de som das duas unidades e matriz de patch (AudioWorklet) |
| `js/engine.js` | Ligação do worklet aos efeitos e à saída |
| `js/defs.js` | Controlos, pontos de patch, memórias e aleatório |
| `js/app.js` | Interface |
| `js/knob.js`, `js/scope.js` | Knob e osciloscópio |
| `sw.js`, `manifest.webmanifest` | Instalação como app e modo offline |
