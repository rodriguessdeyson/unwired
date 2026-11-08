# Exemplos de firmware e de protocolo

Sketches para gravar numa placa e exemplos do protocolo em outras linguagens. O guia do app mostra estes mesmos arquivos (`src/app/features/guide/examples.ts`), então o que mudar aqui muda no app.

Para testar sem hardware, use o simulador: [tools/README.md](../tools/README.md).

| Quero testar | Pasta |
|---|---|
| Arduino com HC-05 ou HC-06 | [`arduino_hc05`](arduino_hc05) |
| ESP32 por Bluetooth clássico | [`esp32_bluetooth_spp`](esp32_bluetooth_spp) |
| ESP32 por BLE, inclusive S3 e C3 | [`esp32_ble_uart`](esp32_ble_uart) |
| ESP32 ou ESP8266 por Wi-Fi | [`esp32_wifi`](esp32_wifi) |
| ESP8266 só com comandos, por Wi-Fi | [`esp8266_http`](esp8266_http) |
| Ligar e desligar um LED, com HC-05 | [`arduino_led`](arduino_led) |
| Temperatura e umidade com DHT11, com HC-05 | [`arduino_dht11`](arduino_dht11) |
| Temperatura com LM35, com HC-05 | [`arduino_lm35`](arduino_lm35) |
| Distância com HC-SR04, com HC-05 | [`arduino_hcsr04`](arduino_hcsr04) |
| Qualquer microcontrolador (PIC, STM32, AVR) em C, com módulo Bluetooth | [`c_generic`](c_generic) |
| MicroPython com HC-05/HC-06 ou por Wi-Fi | [`micropython_uart`](micropython_uart), [`micropython_wifi`](micropython_wifi) |
| Sensor falso por Wi-Fi rodando no PC ou Raspberry Pi | [`node_tcp`](node_tcp), [`python_tcp`](python_tcp) |

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
