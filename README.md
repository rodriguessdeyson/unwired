# unWired

Monitor serial e gráfico ao vivo para microcontroladores, por Bluetooth clássico (SPP), BLE ou Wi-Fi.

Feito com Angular, Ionic, Capacitor e Tailwind. Substitui o app Android antigo, mantendo o pacote `com.rad.unwired`.

## Rodar

```bash
npm install
npm start
```

No navegador, o app usa dispositivos simulados, um para cada caso do painel.

## Android

```bash
npx ng build
npx cap sync android
```

Compile em `android/` com `gradlew.bat assembleDebug`, usando o JDK do Android Studio em `JAVA_HOME`. O Gradle 9.2 deste projeto é o que funciona com o JDK 25 que acompanha o Android Studio.

## Como os dados viram canais

O app lê as linhas recebidas e detecta o formato. Um nome só vira bloco depois de aparecer em 3 linhas, para uma mensagem solta não criar canal.

| O dispositivo envia | Resultado |
|---|---|
| `T=23.4 H=60.1` | Canais `T` e `H` |
| `23.4,60.1` | `Canal 1` e `Canal 2` |
| `{"temp":23.4}` | Canal `temp` |
| `<temp>23.4</temp>` ou `<leitura temp="23.4"/>` | Canal `temp` |
| `23.45` | Canal `Valor` |
| `LED1 ligado` | Só no terminal |

O formato pode ser fixado por dispositivo, inclusive o legado de 5 bytes do unWired antigo.

## Protocolo Wi-Fi (v1)

Protocolo aberto: qualquer firmware que o siga é encontrado na busca, e o app escolhe sozinho entre gráfico e só comandos. A implementação fica em `src/app/core/wifi-protocol.ts`.

1. **Descoberta.** O app envia `DISCOVER_UNWIRED` por broadcast UDP na porta 4210 (configurável em Ajustes). O dispositivo responde para o endereço e a porta de origem:

   ```text
   UNWIRED_ACK;id=<id fixo>;name=<nome>[;tcp=<porta>][;http=<porta>]
   ```

   | Campo | Uso |
   |---|---|
   | `id` | Único e fixo, como o MAC sem os dois-pontos. O perfil do dispositivo (nomes, cores, faixas) fica salvo por ele |
   | `name` | Nome mostrado na lista |
   | `tcp` | Porta do fluxo de dados. Sem ela, o dispositivo é só de comandos |
   | `http` | Opcional. Porta dos comandos HTTP, quando não for a 80 |

2. **Com `tcp`: fluxo de dados.** Conexão TCP nos dois sentidos, uma leitura por linha, com gráfico e terminal. Os comandos seguem pela mesma conexão, com o fim de linha de Ajustes.
3. **Sem `tcp`: só comandos.** Cada comando vira `GET /set?c=<comando>` na porta `http`, e o dispositivo responde 200. O texto vai como está, então `L&r=255` chega como `c=L` e `r=255`. Ao conectar, o app envia `CHECK` como teste.

No cadastro por IP, o modo Automático pergunta direto ao IP. Sem resposta à descoberta, tenta o fluxo TCP e depois os comandos HTTP.

Compatibilidade: o app também envia `DISCOVER_ILUMINUS` e aceita `ILUMINUS_ACK`, tratado como só comandos na porta 80. Se um dispositivo responder aos dois formatos, vale a resposta `UNWIRED_ACK`.

## Testes

```bash
npm test -- --watch=false
```

## CI/CD e teste interno

O fluxo do GitHub Actions valida pull requests e `main`. Tags `vX.Y.Z` geram um
AAB assinado e enviam para o teste interno do Google Play. A configuração de
credenciais, versionamento e publicação está em [docs/ci-cd.md](docs/ci-cd.md).

## Site

Política de privacidade e termos de uso do app unWired (com.rad.unwired), da Rad Apps.

https://rodriguessdeyson.github.io/unwired/
