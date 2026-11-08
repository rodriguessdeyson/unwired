# Ferramentas

| Pasta | Para quê |
|---|---|
| `simulator/` | Simula placas por Wi-Fi ou pela porta COM, sem hardware |
| `ci/` | Versionamento do Android usado pelo GitHub Actions |
| `store-art/` | Gera o ícone, o banner e as capturas da Play Store, e os ícones do launcher para Android 7 (`launcher-icons.mjs`) |

Os sketches e exemplos de protocolo ficam em [examples/](../examples/README.md).

| Quero testar | Use |
|---|---|
| Painel, gráfico e terminal, sem hardware | Simulador por Wi-Fi |
| Bluetooth clássico, sem placa | Simulador pela porta COM |

## Simulador por Wi-Fi

Precisa só do Node. Celular e PC devem estar na mesma rede.

```bash
node tools/simulator/simulator.mjs
```

Ele mostra o IP do PC e sobe um cenário por porta. No app, vá em **Buscar dispositivos > Adicionar Wi-Fi por IP**, escolha **Fluxo TCP** e informe o IP e a porta. No modo **Automático**, o app encontra o cenário anunciado na descoberta:

| Porta | Cenário | O que deve aparecer |
|---|---|---|
| 9001 | `chaves` | Blocos T e H |
| 9002 | `csv` | Canal 1, 2 e 3 |
| 9003 | `json` | Blocos temp e umidade |
| 9004 | `numero` | Bloco Valor |
| 9005 | `legado` | Selecione "Legado de 5 bytes" em Formato dos dados |
| 9006 | `texto` | Sem blocos, só linhas de texto |
| 9007 | `silencioso` | "Aguardando dados" até tocar em Iniciar transmissão |
| 9008 | `parado` | H fica esmaecido depois de 8 s |
| 9009 | `queda` | "Conexão perdida" depois de 10 s |
| 9010 | `rapido` | Cerca de 60 linhas por segundo |
| 9011 | `xml` | Blocos temp e umidade, a partir de XML |

Para testar o modo só de comandos, escolha **Comandos HTTP** e informe só o IP. O simulador usa a porta 80.

A busca do app encontra um cenário por vez, porque cada IP aparece uma vez:

```bash
node tools/simulator/simulator.mjs --cenario csv
```

Para a busca encontrar o PC como só de comandos, ou no formato antigo `ILUMINUS_ACK`:

```bash
node tools/simulator/simulator.mjs --so-comandos
```

```bash
node tools/simulator/simulator.mjs --iluminus
```

## Simulador por Bluetooth clássico

O PC faz o papel de um módulo SPP. Só Bluetooth clássico: o simulador não faz BLE, então para isso use o ESP32.

1. No Windows, abra **Configurações > Bluetooth e dispositivos > Dispositivos > Mais configurações de Bluetooth > Portas COM**.
2. Clique em **Adicionar**, escolha **Entrada** e anote o número da porta criada.
3. Em **Opções**, marque **Permitir que dispositivos Bluetooth localizem este computador**.
4. Pareie o celular com o PC.
5. Rode o simulador com a porta anotada:

```bash
node tools/simulator/simulator.mjs --com COM7 --cenario chaves
```

6. No app, busque e toque no nome do PC.

