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

1. Crie um repositório novo no GitHub (ex.: `quizgen`).
2. Envie todos os arquivos desta pasta para a raiz do repositório
   (pelo site: **Add file → Upload files**, arraste tudo, inclusive a pasta `icons`
   e o arquivo `.nojekyll`).
3. Vá em **Settings → Pages**.
4. Em **Source**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e salve.
5. Em um ou dois minutos o app estará em `https://SEU-USUARIO.github.io/quizgen/`.

## Instalar no celular

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app** (ou “Adicionar à tela inicial”).
- **iPhone (Safari):** abra o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

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
| `icons/` | Ícones do app |
| `.nojekyll` | Faz o GitHub Pages servir os arquivos como estão |

## Atualizar o app

Depois de mudar qualquer arquivo, abra `sw.js` e aumente a versão
(`quizgen-v1` → `quizgen-v2`). Assim os celulares baixam a nova versão.
