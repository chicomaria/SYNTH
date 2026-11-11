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
| Pulso N | Sirin | 2 VCOs com forma de onda contínua e hard sync, filtro ladder, dois ADSR, LFO com S&H, sequenciador de até 32 passos |
| Pulso A | ARP 2600 | 3 VCOs, ring mod, ruído com cor, sample & hold, lag, filtro ladder, ADSR e AR, VCA, reverb de mola, ligações normalizadas e 40 pontos de patch |

## Rack

- **Adicionar, remover, minimizar:** podes ter várias instâncias do mesmo módulo. Minimizado (▾/▸), o módulo fica só com o cabeçalho e os cabos passam a terminar na base do cabeçalho, na posição relativa de cada tomada. O mixer e o osciloscópio também se minimizam (botões ▾ Mixer e ▾ Scope).
- **Relógio master:** ao adicionar um módulo, é ligado automaticamente um cabo do relógio do 1.º módulo do rack para a entrada de relógio do novo (M: ASSIGN → TEMPO, D: TRIGGER → ADV/CLOCK, S e L: CLOCK → CLOCK). O Pulso X não tem relógio. No Pulso M, a entrada TEMPO funciona como entrada de relógio externo, como no hardware.
- **Cabos:** toca numa saída e depois numa entrada de qualquer módulo. Vários cabos na mesma entrada somam-se. Toca numa entrada ligada para tirar o último cabo. Os cabos são desenhados com 70% de opacidade.
- **Aleatório:** patch, sequência e knobs, para todo o rack (barra de topo) ou por módulo.
- **Zoom:** botões − e + na barra de topo.
- **Mixer:** fixo no topo, um canal vertical por módulo com LED de sinal, botões M (mute), S (solo) e ↧ (vai até ao módulo no rack), envios FX1 (reverb) e FX2 (delay), PAN e LEVEL. Ao lado ficam o bloco FX/MASTER e o osciloscópio.
- **Clássicos:** patches que usam técnicas conhecidas destas máquinas (PWM, acid, bombo com envelope de afinação, FM com hard sync, sincronia M+D, polirritmos). Foram montados à mão, não copiados dos livros de patches do fabricante.
- **Modo Ícones** (Visual → Modo): sem knobs nem patch bay. Cada módulo é um núcleo com ícones à volta (oscilador, filtro, envelopes, tempo, mix, envio FX, tocar). Arrastar um ícone muda dois parâmetros ao mesmo tempo (horizontal e vertical); duplo toque repõe o valor. O ícone de sequência gera e deforma a sequência (densidade e alcance). Arrastar o núcleo de um módulo para junto de outro cria cabos automaticamente (mais perto, mais cabos). Os botões aleatórios funcionam também neste modo, e o patch aleatório espalha os módulos.
- **Visual:** menu com skins (Pulso, Clássico, Funky, Anos 70, Aleatório), estilo dos knobs (arco, clássico, aleatório) e layout (Clássico ou Compacto). No Clássico, todos os módulos têm a mesma largura e cada knob, interruptor e botão fica na sua posição do painel, com três tamanhos: knob grande, médio e pequeno (os interruptores e botões têm o footprint do knob pequeno). As posições vêm do conhecimento dos painéis, não foram medidas em fotografias.
- **Banco de patches:** guarda o rack atual com um nome (módulos, knobs, sequências, cabos, mixer e efeitos), carrega, substitui ou apaga. O banco fica no browser e pode ser exportado e importado como ficheiro `.json`.
- Osciloscópio global. O estado fica guardado no browser. Instalável como app (PWA).

## Diferenças conhecidas em relação ao hardware

- O som é um modelo digital, não uma emulação ao nível do circuito.
- Pulso L, Pulso X, Pulso N e Pulso A foram feitos a partir da arquitetura geral desses instrumentos. Os controlos e os pontos de patch não foram conferidos um a um com os manuais.
- Pulso X não tem entrada de microfone: o programa do vocoder vem de um cabo (por exemplo, a saída VCA de outro módulo).
- Pulso M: o sequenciador guarda nota e pausa por passo (sem acento, ratchet, swing, nem os 64 padrões). A saída ASSIGN envia sempre o relógio de passos.
- Pulso S: quantização só em 12-ET; sem modos de afinação justa.
- Pulso N: o Sirin real é uma caixa de secretária com poucos controlos e menus; aqui os parâmetros estão todos no painel, e o sequenciador é o mesmo do Pulso M (sem arpejador).
- Pulso A: os sliders do 2600 aparecem como knobs, o teclado é o do sequenciador, e as ligações normalizadas foram simplificadas.
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
