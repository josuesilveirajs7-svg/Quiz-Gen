# QuizGen

Quiz de qualquer tema que funciona como aplicativo no celular (PWA).
Você digita um tema e o QuizGen pesquisa na internet com a Pesquisa Google e
monta 15 perguntas de múltipla escolha, em 3 níveis (Fácil, Médio e Difícil).

- Fontes: sites confiáveis da internet (universidades, governo, Britannica,
  documentação oficial, revistas científicas…). **A Wikipédia é excluída.**
- Não usa o Claude. Usa o Gemini do Google com uma **chave gratuita sua**.
- Histórico e chave ficam salvos só no seu aparelho.
- Funciona offline para abrir o app e ver o histórico.

## Publicar no GitHub Pages

> **Importante:** todos os arquivos ficam soltos na raiz do repositório, sem pastas.
> O `index.html` precisa aparecer logo na primeira tela do repositório.

1. Crie um repositório **público** no GitHub (ex.: `quizgen`).
2. Toque em **Add file → Upload files** e envie os **10 arquivos** de uma vez:
   `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`,
   `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `README.md`.
   Depois toque em **Commit changes**.
3. Vá em **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**,
   branch `main`, pasta `/ (root)`, e toque em **Save**.
4. Espere 1 ou 2 minutos e abra `https://SEU-USUARIO.github.io/quizgen/`
   (o endereço aparece no topo da página **Settings → Pages**).

## Instalar no celular

Abra o endereço do passo 4 e toque em **Instalar o QuizGen** na tela inicial do app.
Essa tela mostra um **diagnóstico** com ✓ ou ✕ e diz exatamente o que corrigir se algo faltar.

- **Android (Chrome):** botão **Instalar agora**, ou menu ⋮ → **Instalar app**.
- **iPhone:** o aviso não aparece sozinho. Toque em **Compartilhar** → **Adicionar à Tela de Início**.

Problemas comuns:
- Abrir a página do repositório (`github.com/...`) em vez do site (`...github.io/...`).
- Abrir o link dentro do Instagram/Facebook/WhatsApp: use “Abrir no navegador”.
- Arquivos dentro de uma pasta: eles precisam estar na raiz, junto do `index.html`.

## Chave gratuita do Gemini

1. Abra https://aistudio.google.com/apikey e entre com sua conta Google.
2. Clique em **Create API key** e copie a chave.
3. No QuizGen, toque na engrenagem ⚙️, cole a chave e salve.

A chave fica só no `localStorage` do seu navegador. **Nunca coloque a chave nos
arquivos do repositório**, porque o GitHub Pages é público.

O plano gratuito tem limite de uso por minuto e por dia. Se aparecer o aviso de
limite, espere alguns minutos. Se o Google mudar o nome do modelo, troque o campo
**Modelo** nas configurações pelo nome que aparece no Google AI Studio.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Telas do app |
| `style.css` | Visual, incluindo modo escuro automático |
| `app.js` | Pesquisa, geração das perguntas, quiz, resultado e histórico |
| `manifest.webmanifest` | Nome, cores e ícones do app instalado |
| `sw.js` | Service worker (abre offline e mais rápido) |
| `` | Ícones do app |
| `.nojekyll` | Faz o GitHub Pages servir os arquivos como estão |

## Atualizar o app

Depois de mudar qualquer arquivo, abra `sw.js` e aumente a versão
(`quizgen-v5` → `quizgen-v6`) e o `?v=5` no index.html (→ `?v=6`). Assim os celulares baixam a nova versão.
