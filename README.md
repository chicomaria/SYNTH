# Pulso

Sintetizador percussivo semi-modular que corre no browser, inspirado no estilo das drum machines analógicas semi-modulares, mas simplificado. Não tem teclado: o som é tocado por um sequenciador de 8 passos, com memórias pré-gravadas e um gerador aleatório.

## O que tem

- **Dois osciladores (VCO 1 e VCO 2)** com forma de onda triangular ou quadrada, envelope de afinação e FM de VCO 2 para VCO 1.
- **Ruído branco**, misturado com os osciladores.
- **Filtro passa-baixo** com ressonância e envelope próprio.
- **Amplitude** com decay ajustável.
- **Ligações** (um patch bay simplificado): escolhe se a afinação de cada passo vai para VCO 1, VCO 2 ou filtro, e se a velocidade controla o volume ou o filtro.
- **Sequenciador de 8 passos** com afinação e velocidade por passo, BPM e swing.
- **Memórias** (Bombo, Metálico, Baixo ácido, Chuva) e **aleatório** para a sequência, o som ou tudo.
- **Delay**, **reverb** e **osciloscópio**.
- Knobs que funcionam com rato, toque, roda do rato e teclado. O estado fica guardado no browser.
- **Instalável como app** (PWA) e funciona offline.

## Correr localmente

Não há dependências nem build. Basta servir a pasta:

```sh
python3 -m http.server 8000
# abre http://localhost:8000
```

(Abrir o `index.html` diretamente com `file://` não funciona, porque os módulos JavaScript precisam de um servidor.)

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `js/engine.js` | Motor de som (Web Audio API) |
| `js/sequencer.js` | Relógio e sequenciador de 8 passos |
| `js/presets.js` | Valores por defeito, memórias e aleatório |
| `js/knob.js` | Componente de knob |
| `js/scope.js` | Osciloscópio |
| `js/app.js` | Interface e ligação de tudo |
| `sw.js`, `manifest.webmanifest` | Instalação como app e modo offline |

## Próximos passos possíveis

- Converter para app nativa com [Capacitor](https://capacitorjs.com/) (iOS/Android) ou [Tauri](https://tauri.app/) (desktop), reaproveitando este código.
- Mais passos, várias pistas, guardar memórias próprias.
- MIDI e sincronização externa.
