# CI/CD do unWired

Segue o modelo do Ohm Finder: GitHub Actions, tags `vX.Y.Z`, ambiente
`google-play-internal` e envio do AAB assinado para a faixa `internal` do pacote
`com.rad.unwired`. Não publica em produção. Não usa o armazenamento R2 do outro app.

## Validação

Pull requests e pushes em `main` executam instalação pelo lockfile, testes do app,
testes do versionamento, build web, `cap sync android`, `assembleDebug` e
`bundleRelease` sem assinatura. O `cap sync` falha se o `index.html` não chegar ao
projeto Android. O `bundleRelease` roda a checagem de anúncios de
`android/app/build.gradle`: IDs de teste do Google ou `testAds: true` quebram o PR.
Tags `v*` passam pelas mesmas verificações antes do job de publicação.
O Node 24.15.0 atende ao Angular 22 deste projeto; o CI usa Java 21.
O navegador usa dispositivos simulados: o CI não comprova funcionamento Bluetooth
em hardware real.

## Configuração no GitHub

Repositório indicado: [rodriguessdeyson/unwired](https://github.com/rodriguessdeyson/unwired).
O app fica na raiz, com `android/`, o wrapper Gradle e o lockfile npm. O
`index.html` da raiz continua sendo o site de privacidade; a entrada do app é
`src/index.html`. O GitHub Pages continua usando `main` e a raiz, sem publicar
o build Angular. O arquivo `_config.yml` exclui as pastas e configurações do app
da geração do site. Alterar o site não é parte do fluxo Android.
O ambiente `google-play-internal` existe, aceita só tags `v*` e exige aprovação de
`rodriguessdeyson` antes de publicar. Configure os seguintes secrets nesse ambiente
(os valores nunca entram no Git):

| Secret | Conteúdo |
| --- | --- |
| `UNWIRED_ANDROID_SIGNING_KEY` | Keystore de upload do **unWired** codificado em Base64 |
| `UNWIRED_ANDROID_KEY_ALIAS` | Alias da chave de upload |
| `UNWIRED_ANDROID_STORE_PASSWORD` | Senha do keystore |
| `UNWIRED_ANDROID_KEY_PASSWORD` | Senha da chave |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | JSON da conta de serviço autorizada no Play Console para o unWired |

Para gravar um secret sem que o valor fique no histórico do terminal, rode o comando
e cole o valor quando ele pedir:

```bash
gh secret set UNWIRED_ANDROID_KEY_ALIAS -R rodriguessdeyson/unwired --env google-play-internal
```

O keystore e o JSON podem ir direto de arquivo:

```bash
base64 -w0 caminho/da/chave.jks | gh secret set UNWIRED_ANDROID_SIGNING_KEY -R rodriguessdeyson/unwired --env google-play-internal
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON -R rodriguessdeyson/unwired --env google-play-internal < caminho/da/conta-de-servico.json
```

Não use a chave do Ohm Finder por semelhança de projeto. A chave precisa corresponder
ao certificado de upload registrado para `com.rad.unwired` em Integridade do app.
A API Google Play Android Developer deve estar habilitada; a conta de serviço
precisa de acesso ao app e permissão de lançar versões nas faixas de teste.
Não precisa de acesso a produção. Regras de proteção do ambiente podem restringir
releases a tags aprovadas e exigir um revisor.

Adicione também a variável de ambiente `ANDROID_LAST_PUBLISHED_VERSION_CODE` com
o **maior versionCode já enviado** ao Play Console, inclusive em outras faixas.
Confira em Explorador de apps antes da primeira execução e atualize esse valor
depois de cada envio, inclusive se for feito manualmente. Sem essa informação o
workflow falha, em vez de adivinhar o histórico do app legado.

## Publicar um teste interno

1. Confira o versionCode anterior no Console e configure a variável acima.
2. Escolha uma tag `vMAJOR.MINOR.PATCH`, sem zeros à esquerda ou sufixos. O cálculo
   é `MAJOR * 10000 + MINOR * 100 + PATCH`; MINOR e PATCH ficam entre 0 e 99.
   Exemplo: `v2.0.1` gera `versionName=2.0.1`, `versionCode=20001`.
   Esse exemplo só serve se 20001 for maior que todos os códigos anteriores.
3. Com o código validado e enviado ao remoto, crie e envie a tag. Exemplo:

   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```

4. Acompanhe `App CI/CD`. O job de publicação só roda em push de tag, nunca em
   pull request ou push comum. Os envios internos são serializados.
5. Confira o AAB e a versão em Teste interno no Play Console e atualize a variável
   com o novo versionCode. Reexecutar a mesma tag após um upload concluído pode
   ser recusado pelo Play; uma versão nova exige código maior.

O AAB é assinado com `jarsigner` e verificado antes do envio. O keystore temporário
é removido ao fim da etapa, inclusive se a assinatura falhar. As senhas são lidas
de variáveis de ambiente, sem argumentos contendo seus valores.

O envio usa `changesNotSentForReview: true` para não submeter automaticamente as
alterações pendentes da ficha da loja. Se o Google exigir revisão para a versão,
o proprietário precisará concluir esse passo no Console; o workflow não tenta
reenviar com essa proteção desativada. O estado de remoção do app, políticas
pendentes ou falta de permissões também podem impedir a disponibilização do teste.

As propriedades `-PversionCode` e `-PversionName` controlam apenas o build de CI.
Sem elas, o build local usa os valores de `android/app/build.gradle` (hoje 20001 e
2.0.1); suba esses valores antes de gerar um AAB à mão. Não altere o applicationId.

Referências: [upload-google-play](https://github.com/r0adkll/upload-google-play),
[versionamento Android](https://developer.android.com/studio/publish/versioning).
