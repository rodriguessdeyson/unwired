# Artes da Play Store

## Onde ficam

As imagens enviadas ficam em `fastlane/metadata/android/<idioma>/images/`, no formato do `fastlane supply`:

| Arquivo | Tamanho |
|---|---|
| `icon.png` (só em `pt-BR`) | 512×512 |
| `featureGraphic.png` | 1024×500 |
| `phoneScreenshots/1.png` a `5.png` | 1080×1920, proporção 9:16 |

No Console, os idiomas que não têm pasta própria usam as imagens do idioma mais próximo:

| Idiomas no Console | Pasta |
|---|---|
| pt-BR | `pt-BR` |
| en-US, en-GB | `en-US` |
| es-419, es-ES, es-US | `es-419` |

## Gerar de novo

Os geradores ficam em `tools/store-art/`.

1. Suba o app: `npm start -- --port 4311`.
2. Rode `node tools/store-art/shots.mjs pt` (depois `en` e `es`). O script abre o Chrome headless em 1080×1920, conecta no "ESP32 Sensor" simulado e salva as telas em `tools/store-art/raw/`. Os passos ficam em `steps.mjs`.
3. Rode `node tools/store-art/render.mjs`. Ele gera o ícone, os banners e as capturas montadas em `tools/store-art/out/`. As capturas são montadas por `compose.html`, os banners por `feature.html` e o ícone por `icon.html`.
4. Copie o resultado para as pastas do `fastlane/`.

As pastas `raw/` e `out/` não vão para o Git. Os scripts usam o Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe`; o `render.mjs` aceita outro caminho como argumento.

## Enviar ao Console

Página "Detalhes do app" principal:
https://play.google.com/console/u/0/developers/5948005476182122634/app/4975759653368852638/store-listings/default/edit

- Remova as imagens antigas. Para enviar, use "Adicionar recursos" e depois "Enviar".
- Envie as capturas uma de cada vez, na ordem: enviadas juntas, elas entram fora de ordem.
- Clique em "Salvar como rascunho" antes de trocar de idioma ou sair da página. Sair sem salvar descarta tudo.
- O envio para revisão é feito à parte, em "Visão geral da publicação".
