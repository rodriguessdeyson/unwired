# Ambientes de teste

Duas formas de enviar dados para o unWired: um simulador no PC, sem hardware, e sketches para gravar em uma placa.

| Quero testar | Use |
|---|---|
| Painel, gráfico e terminal, sem hardware | Simulador por Wi-Fi |
| Bluetooth clássico, sem placa | Simulador pela porta COM |
| Arduino com HC-05 ou HC-06 | `firmware/arduino_hc05` |
| ESP32 por Bluetooth clássico | `firmware/esp32_bluetooth_spp` |
| ESP32 por BLE, inclusive S3 e C3 | `firmware/esp32_ble_uart` |
| ESP32 ou ESP8266 por Wi-Fi | `firmware/esp32_wifi` |
| ESP8266 só com comandos, por Wi-Fi | `firmware/esp8266_http` |
| Ligar e desligar um LED, com HC-05 | `firmware/arduino_led` |
| Temperatura e umidade com DHT11, com HC-05 | `firmware/arduino_dht11` |
| Temperatura com LM35, com HC-05 | `firmware/arduino_lm35` |
| Distância com HC-SR04, com HC-05 | `firmware/arduino_hcsr04` |

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

## Sketches

Abra a pasta do sketch no Arduino IDE. Em `arduino_hc05`, confira a ligação descrita no início do arquivo e use em `MODULE_BAUD` a velocidade gravada no módulo. Em `esp32_wifi`, preencha o nome e a senha da rede.

Os sketches de conexão enviam `T=... H=...` a cada 200 ms, aceitam `LS` e `DS` e devolvem os outros comandos como eco. Troque os valores de exemplo pela leitura dos seus sensores.

Os sketches de projeto (`arduino_led`, `arduino_dht11`, `arduino_lm35` e `arduino_hcsr04`) leem o componente de verdade e aceitam `LS` e `DS`. Cada um traz a ligação dos fios no início do arquivo. O `arduino_dht11` precisa da biblioteca DHT sensor library, da Adafruit.

## Protocolo Wi-Fi

Para o app achar seu firmware sozinho, responda ao UDP `DISCOVER_UNWIRED` na porta 4210 com:

```text
UNWIRED_ACK;id=<id fixo>;name=<nome>[;tcp=<porta>][;http=<porta>]
```

Com `tcp`, o app abre um fluxo TCP com gráfico e terminal. Sem `tcp`, abre só comandos: cada comando vira `GET /set?c=<comando>` na porta `http` (padrão 80), e o firmware responde 200. A especificação completa está no README do projeto.
