# US-036 CA3 — Captura de foto direto da câmera com geolocalização embutida

## O que foi feito

Integração de captura de foto via câmera no formulário de registro rápido, com extração de coordenadas GPS dos metadados EXIF da imagem.

## Por quê

O produtor precisa documentar visualmente operações no campo (ex: estado da lavoura após pulverização). A foto com geolocalização comprova onde a operação foi realizada.

## Arquivos modificados

- `app/(app)/(tabs)/register.tsx` — Substituído placeholder por câmera real

## Dependência adicionada

- `expo-image-picker` — Captura de foto via câmera nativa

## Funcionalidades implementadas

1. **Captura via câmera** — `ImagePicker.launchCameraAsync` com qualidade 0.8 e EXIF habilitado
2. **Permissão** — Solicita permissão de câmera com mensagem clara se negada
3. **Preview** — Mostra foto capturada com `Image` (200px altura, cover)
4. **Ações pós-captura** — "Tirar outra" (substitui) e "Remover" (limpa)
5. **Geolocalização via EXIF** — Se a foto tem GPS nos metadados EXIF e o app ainda não tem coordenadas, usa-as como fallback
6. **Persistência** — URI da foto salva em `photo_uri` na tabela `field_operations`
7. **Reset** — Foto é limpa ao salvar e resetar o formulário
8. **Haptic feedback** — Light impact ao capturar/remover
