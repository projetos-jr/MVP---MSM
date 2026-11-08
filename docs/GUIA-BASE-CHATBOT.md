# Guia base: chatbot interno com IA (modelo MSM)

Este guia descreve o MVP do **Assistente MSM**, feito pela UFABC Jr para a MSM Caldeiraria, e ensina a criar
o mesmo chatbot para **outra empresa**, com a identidade visual e os documentos dela.

**Estratégia:** não reconstruir do zero. O novo projeto **copia o código deste repositório**, numa versão
fixa (commit `d30904e`, a versão apresentada à MSM), e troca só a marca e os documentos. Assim ele já nasce com todas as correções
descobertas no projeto da MSM (seção 7).

---

## Sumário

0. [Como usar este guia (equipe UFABC Jr)](#0-como-usar-este-guia-equipe-ufabc-jr)
1. [Prompt para colar no Claude Code](#1-prompt-para-colar-no-claude-code)
2. [O produto](#2-o-produto)
3. [Tecnologias e arquitetura](#3-tecnologias-e-arquitetura)
4. [Mapa do código](#4-mapa-do-código)
5. [Como adaptar para uma nova empresa](#5-como-adaptar-para-uma-nova-empresa)
6. [Base de conhecimento (documentos)](#6-base-de-conhecimento-documentos)
7. [Lições aprendidas (não repetir)](#7-lições-aprendidas-não-repetir)
8. [Configuração e publicação](#8-configuração-e-publicação)
9. [Testes](#9-testes)
10. [Roteiro de demonstração](#10-roteiro-de-demonstração)
11. [Custos e proposta (resumo interno)](#11-custos-e-proposta-resumo-interno)

---

## 0. Como usar este guia (equipe UFABC Jr)

1. **Junte os materiais da nova empresa** (checklist na seção 5.1): nome, site, logo, uma foto de produto,
   cores e os documentos que vão alimentar o chatbot. O mínimo é o **site oficial**: dá para tirar quase
   tudo dele.
2. **Crie um repositório vazio no GitHub**, por exemplo `projetos-jr/MVP---NOME-DA-EMPRESA`.
3. **Abra uma nova sessão do Claude Code** com esse repositório.
4. **Cole o prompt da seção 1**, preencha os campos entre `< >` e anexe este arquivo (ou peça para o Claude
   lê-lo direto do repositório base, em `docs/GUIA-BASE-CHATBOT.md`).
5. Quando o Claude terminar, **publique** (seção 8) e **ensaie a demo** (seção 10) com a chave real do Gemini.

O repositório base precisa estar acessível na nova sessão. Se o Claude não conseguir clonar, peça para ele
adicionar `projetos-jr/MVP---MSM` à sessão.

---

## 1. Prompt para colar no Claude Code

> Copie o texto abaixo, preencha o que está entre `< >` e cole numa nova sessão do Claude Code, aberta no
> repositório novo (vazio). Anexe este guia.

```text
Você vai criar o MVP de um assistente interno com IA para a empresa <NOME DA EMPRESA>
(<CIDADE/UF>), site oficial <URL DO SITE>. É o mesmo produto que fizemos para a MSM Caldeiraria,
com a identidade visual e os documentos da nova empresa. A apresentação é <DATA>.

O guia anexo (GUIA-BASE-CHATBOT.md) explica o produto, a arquitetura, o que trocar e as lições
aprendidas. Leia o guia inteiro antes de começar e siga-o.

1. Copie o código-base: o commit d30904efb82a15a36d85c036cd1b52e47ab38141 do repositório
   projetos-jr/MVP---MSM (se não tiver acesso, adicione esse repositório à sessão). Copie todos os arquivos para este repositório,
   exceto .git, node_modules e .next (comandos na seção 5.2 do guia).
2. Colete a identidade visual no site oficial (seção 5.4 do guia): logo em alta resolução,
   cores, fontes, a cor de sobreposição das fotos e uma foto de produto/serviço real para a tela
   de entrada. Mostre o que encontrou antes de aplicar.
3. Troque a marca em todos os pontos da seção 5.3 do guia e gere as imagens com
   scripts/marca/gerar-imagens.py.
4. Monte a base de conhecimento (seção 6 do guia): documentos com as informações reais do site,
   conferidos página por página, e 3 a 4 processos fictícios marcados como EXEMPLO.
   <SE TIVER DOCUMENTOS PRÓPRIOS: "Use também os documentos anexos.">
5. Atualize as 4 sugestões de perguntas, o prompt do assistente e o README para a nova empresa.
6. Não mude a arquitetura nem desfaça as soluções da seção 7 do guia sem um motivo claro.
7. Teste tudo (seção 9 do guia): npm run lint, npm run build e o teste de ponta a ponta com o
   Gemini simulado. Mostre as capturas de tela do desktop e do celular.
8. Faça commits pequenos e descritivos e envie para o repositório.
9. No final, me passe um resumo e o passo a passo de publicação (seção 8 do guia).

Nome do produto na tela: <Assistente NOME>. Senha de acesso da demo: <SENHA>.
Escreva tudo em português do Brasil.
```

---

## 2. O produto

Os colaboradores perguntam por **texto ou voz** sobre processos, serviços, funções e procedimentos da empresa.
O assistente responde **somente com base nos documentos de uma pasta do Google Drive** e cita a fonte de cada
resposta. Arquivo novo ou alterado na pasta passa a valer sozinho, sem passo manual.

**Telas:**

| Tela | Endereço | O que tem |
| --- | --- | --- |
| Entrada | `/entrar` | Foto de produto da empresa ao fundo com degradê da cor escura da marca; no centro, card branco com o logo, o nome do produto e o formulário (nome do colaborador + senha única). |
| Início do chat | `/` | Logo no centro, "Olá, Nome! Tudo bem?", texto curto e 4 sugestões de perguntas. Menu lateral com as conversas. |
| Conversa | `/` | Respostas em streaming, em Markdown, com fontes (links), copiar, ouvir em voz alta e 👍/👎. Campo com microfone (ditado em pt-BR). |
| Base de conhecimento | `/documentos` | Arquivos da pasta com tipo, data, status (lido, erro, não suportado), "Atualizar agora" e "Abrir pasta no Drive". |
| Documento (modo de teste) | `/documentos/local?id=…` | Mostra um arquivo de `seed-docs/` quando o Drive ainda não está configurado. |
| Diagnóstico | `/api/diagnostico` | JSON com a configuração (sem segredos) e o teste de cada modelo de IA. Gasta 1 pergunta por modelo. |

**Funcionalidades:** senha única (`APP_PASSWORD`) com cookie de sessão; histórico de conversas no navegador
(`localStorage`); "Apagar histórico" no menu do usuário (para aparelhos compartilhados); sugestões de
perguntas; resposta "não encontrei nos documentos, procure o responsável" quando a informação não existe;
versão para celular, que pode ser **instalada na tela inicial** como aplicativo (manifest + ícones).

**Modos de teste**, para a demo funcionar antes de configurar tudo:
- Sem `DRIVE_FOLDER_ID`, os documentos vêm da pasta `seed-docs/` do projeto.
- Sem `GEMINI_API_KEY`, o chat mostra os trechos mais relevantes dos documentos e avisa que está sem IA.

---

## 3. Tecnologias e arquitetura

| Parte | Escolha | Por quê |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript | Front e back no mesmo projeto, deploy fácil. |
| Interface | Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react | Componentes prontos e acessíveis. |
| IA | Google Gemini via `@google/genai`, isolado em `lib/llm.ts` | Plano gratuito para a demo; trocar de provedor = reescrever um arquivo. |
| Documentos | `@googleapis/drive` (conta de serviço, só leitura) | Mesmo cliente do `googleapis`, mas ~2 MB em vez de ~250 MB. |
| Extração | `pdf-parse` (PDF), `mammoth` (DOCX), export do Google (Docs/Sheets/Slides) | Lê os formatos mais comuns. |
| Busca | Contexto inteiro ou BM25 por trechos (`lib/retrieval.ts`) | Sem banco vetorial no MVP; no produto final vira busca vetorial. |
| Voz | Web Speech API do navegador (pt-BR) | Sem custo e sem servidor. |
| Hospedagem (demo) | Vercel, plano gratuito | Só para demonstração: o plano gratuito não permite uso comercial. |

**Fluxo de uma pergunta** (`app/api/chat/route.ts`):

```
Navegador ──POST /api/chat──► carrega a base (cache em memória, revisado a cada 2 min)
                              ► escolhe o contexto (tudo, ou trechos BM25 se passar de MAX_CONTEXT_CHARS)
                              ► lib/llm.ts → Gemini em streaming (principal; se travar ou bater o limite → reserva)
          ◄── NDJSON ─────────  meta · ping (a cada 4 s) · text… · sources · done | error
```

- **Fontes:** o modelo termina a resposta com um marcador escondido `<<FONTES: 1, 3>>`; o servidor esconde o
  marcador durante o streaming (`lib/answer.ts`) e transforma os números em links. Documentos citados pelo nome
  (em itálico, negrito ou aspas) também entram.
- **Atualização da base:** cache por `fileId + modifiedTime` (`lib/knowledge.ts`); a cada pergunta, se a última
  verificação tiver mais de 2 minutos, lista a pasta de novo e reprocessa só o que mudou. "Atualizar agora" força.
- **Segurança:** `middleware.ts` protege todas as páginas e APIs; libera só `/entrar`, `/api/login` e arquivos
  estáticos (foto de fundo, ícones, manifest).

---

## 4. Mapa do código

Coluna "Trocar?": **Sim** = muda para cada empresa; **Talvez** = só se a empresa pedir; **Não** = não mexer.

| Arquivo | O que faz | Trocar? |
| --- | --- | --- |
| `config/brand.ts` | **Toda a marca:** nomes, cores, logo, foto de fundo, sugestões de perguntas. Cores viram variáveis CSS `--brand-*`. | **Sim** |
| `public/logo.png`, `public/logo-mark.png`, `public/login-bg.jpg` | Logo completo, só o símbolo (avatar), foto da entrada. | **Sim** |
| `app/icon.png`, `app/apple-icon.png`, `public/icons/*` | Ícones da aba, do iPhone e do app instalado. | **Sim** |
| `lib/prompt.ts` | Prompt de sistema e regras da IA (cita o nome da empresa). | **Sim** |
| `app/entrar/page.tsx` | Tela de entrada: texto sob o título e cores do degradê escritas no código. | **Sim** |
| `components/app-header.tsx` | Cabeçalho; iniciais padrão do avatar ("MSM"). | **Sim** |
| `seed-docs/` | Documentos do modo de teste (e para subir no Drive). | **Sim** |
| `README.md`, `package.json` (`name`), `.env.example` (título) | Documentação e nome do projeto. | **Sim** |
| `app/layout.tsx` | Fontes (Montserrat nos títulos, Open Sans no texto) e metadados. | Talvez |
| `components/chat/*.tsx`, `app/entrar/page.tsx` | Sombras levemente azuladas `rgba(30,42,94,…)`. | Talvez |
| `lib/auth.ts`, `lib/chat-storage.ts`, `lib/knowledge.ts` | Prefixos `msm_` / `msm.` de cookies, `localStorage` e cache. Funcionam como estão. | Talvez |
| `lib/llm.ts` | Provedor de IA (Gemini), prazos, modelo reserva, diagnóstico. | Não |
| `lib/llm-offline.ts` | Modo de teste sem IA. | Não |
| `lib/drive.ts`, `lib/local-docs.ts`, `lib/extract.ts`, `lib/file-types.ts` | Leitura do Drive e de `seed-docs/`, extração de texto. | Não |
| `lib/knowledge.ts`, `lib/retrieval.ts`, `lib/answer.ts` | Cache da base, busca BM25, marcador de fontes. | Não |
| `lib/env.ts` | Variáveis de ambiente e padrões (modelos, prazos, limites). | Não |
| `app/api/*` | Chat, documentos, login/logout, diagnóstico. | Não |
| `components/chat/chat-app.tsx` | Estado do chat, streaming, histórico, retry. | Não |
| `middleware.ts`, `next.config.ts` | Proteção por senha; empacotamento para a Vercel. | Não |
| `scripts/teste/*` | Gemini simulado e teste de ponta a ponta. | Não |
| `scripts/marca/gerar-imagens.py` | Gera logo, símbolo, ícones e foto de fundo. | Não |

---

## 5. Como adaptar para uma nova empresa

### 5.1 O que coletar

| Item | Onde conseguir | Observação |
| --- | --- | --- |
| Nome da empresa, nome curto, razão social, cidade/UF | Site (rodapé, "Sobre nós") | Razão social costuma estar no rodapé ou na política de privacidade. |
| Nome do produto na tela | Definir com a equipe | Padrão: "Assistente <NOME CURTO>". |
| Logo em alta resolução, PNG com fundo transparente | Site (`<img>` do cabeçalho; procure versões grandes em `/wp-content/uploads/`) ou pedir ao cliente | Fundo branco também funciona. |
| Cor principal e cor escura da marca | CSS do site (botões, cabeçalho) e o próprio logo | A principal vai em botões e na faixa do topo; a escura em títulos e menu lateral. |
| Cor de sobreposição das fotos | CSS do site (no WordPress/Elementor: `background-overlay` em `/wp-content/uploads/elementor/css/post-*.css`) | Na MSM: `#041E42` com 50% de opacidade. |
| Fontes | CSS do site (`font-family`) | Opcional; com `next/font/google` se for do Google Fonts. |
| Foto de produto ou serviço real | Páginas de cases, serviços ou galeria do site; a maior versão disponível | Prefira foto horizontal ou quadrada, ≥ 960 px. |
| Documentos | Site (institucional, serviços, setores, cases, qualidade, contato) + processos fictícios | Seção 6. |
| 4 sugestões de perguntas | Escritas a partir dos documentos | Todas precisam ter resposta nos documentos. |
| Senha da demo | Definir com a equipe | Vai em `APP_PASSWORD`. |

### 5.2 Copiar o código-base

Na raiz do repositório novo (vazio). O commit `d30904e` é a versão-base: tem o app exatamente como foi
apresentado à MSM, mais este guia e os scripts. Se ele não existir mais, use a branch padrão do repositório.

```bash
git clone https://github.com/projetos-jr/MVP---MSM.git /tmp/base-chatbot
```

```bash
git -C /tmp/base-chatbot checkout d30904efb82a15a36d85c036cd1b52e47ab38141
```

```bash
tar -C /tmp/base-chatbot --exclude=.git --exclude=node_modules --exclude=.next -cf - . | tar -xf -
```

```bash
npm install
```

### 5.3 Pontos de troca (lista completa)

1. **`config/brand.ts`:** `productName`, `companyName`, `companyLegalName`, `companyLocation`, `tagline`,
   `logo` (`alt`, `width`, `height`), `logoMark` (`alt`, `width`, `height`), `loginBackground`, todas as cores e
   `suggestions`. Nomes das cores: `primary` = cor principal (botões, faixa do topo, destaques); `navy` = cor
   escura (títulos, menu lateral, mensagens do usuário); `navyDeep` = cor de sobreposição das fotos. Os nomes
   ficam "navy" mesmo que a cor da nova empresa não seja azul: só os valores mudam.
2. **Imagens:** rode o gerador (Pillow necessário) e copie os tamanhos que ele imprime para `brand.logo` e
   `brand.logoMark`:
   ```bash
   python3 scripts/marca/gerar-imagens.py --logo caminho/do/logo.png --foto caminho/da/foto.jpg
   ```
   Confira o `public/logo-mark.png`: ele deve ser só o símbolo ou as letras principais do logo. Se o logo não
   tiver uma faixa vazia separando símbolo e texto, o script usa o logo inteiro; nesse caso, recorte à mão.
   Se o logo for claro (feito para fundo escuro), peça ou crie a versão para fundo branco.
3. **`lib/prompt.ts`:** em `SYSTEM_PROMPT`, troque "Assistente MSM" e "MSM Caldeiraria"; na regra 6, troque
   "relação com a MSM" e "base de conhecimento da MSM".
4. **`app/entrar/page.tsx`:** troque a frase fixa "Tire dúvidas sobre processos, serviços e procedimentos da
   MSM." por `{brand.tagline}`; troque as cores do degradê e da sombra: `4,30,66` = RGB de `navyDeep` e
   `30,42,94` = RGB de `navy`. Para achar todas:
   ```bash
   grep -rn "4,30,66\|30,42,94" app components
   ```
   Ajuste as opacidades até a foto aparecer bem e o card branco continuar legível (seção 9 mostra como ver as
   capturas no celular e no desktop).
5. **`components/app-header.tsx`:** troque o `"MSM"` de `initials(userName || "MSM")` pelo nome curto.
6. **`seed-docs/`:** apague os documentos da MSM e coloque os da nova empresa (seção 6).
7. **`README.md`**, `name` do `package.json`, título do `.env.example` e e-mail de exemplo
   (`assistente-msm@…`).
8. **Talvez:** fontes em `app/layout.tsx`; prefixos `msm` de cookies/localStorage
   (`lib/auth.ts`, `lib/chat-storage.ts`, `lib/knowledge.ts`); comentários que citam a MSM.

Depois de trocar, confira se sobrou algo da MSM:

```bash
grep -rniI "msm\|caldeiraria\|ribeirão" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=capturas --exclude=package-lock.json --exclude=GUIA-BASE-CHATBOT.md .
```

### 5.4 Padrão visual (o que manter)

- **Entrada:** foto real de um produto ou serviço da empresa em tela cheia, com sobreposição na cor escura
  da marca (degradê diagonal + vinheta), no estilo dos cases do site. No centro, card branco: logo, uma
  linha fina da cor principal, nome do produto em maiúsculas, uma frase e o formulário. No celular, o card
  fica mais compacto e o degradê mais claro para a foto aparecer.
- **Cabeçalho:** faixa fina da cor principal no topo, logo à esquerda, nome do produto (desktop), links
  "Chat" e "Base de conhecimento", avatar com as iniciais e menu (apagar histórico, sair).
- **Início do chat:** logo grande no centro, "Olá, Nome! Tudo bem?", uma frase e 4 sugestões em cards.
- **Respostas:** avatar com o símbolo do logo, card branco, listas numeradas com números na cor principal,
  negrito na cor escura, fontes como etiquetas com link.
- **Menu lateral:** fundo na cor escura, botão "Nova conversa" na cor principal.
- **Tipografia:** títulos em fonte de destaque, seções em maiúsculas espaçadas (`.section-title`).

---

## 6. Base de conhecimento (documentos)

O MVP da MSM usou 9 documentos em Markdown, em dois grupos:

1. **Informações reais, resumidas do site e conferidas com ele** (5 documentos): institucional (história,
   razão social, estrutura, números do site), serviços, setores/clientes/cases, política de qualidade e
   certificações, contatos.
2. **Processos fictícios**, com nome começando por `EXEMPLO -` e um aviso no início de que são fictícios
   (4 documentos): solicitação de compra, integração de novo colaborador, máquina com defeito e abertura de
   chamado de TI. Eles mostram o que o assistente faz com processos internos e serão trocados pelos processos
   mapeados no projeto.

**Regras:**
- **O nome do arquivo aparece nas fontes do chat:** use nomes legíveis ("Serviços da EMPRESA.md"), nunca
  "02-servicos.md".
- **Confira cada fato abrindo a página do site.** Na MSM, o rascunho dizia que um case era da Parker, mas o
  site informa cliente confidencial; outros cases tinham cliente e cliente final diferentes. Nunca atribua um
  cliente que o site mantém em sigilo.
- **Use Markdown simples:** um `#` por documento, `##` por seção, listas; linhas de rótulo seguidas
  ("**Responsável:** …") viram itens de lista, senão aparecem grudadas.
- **Processos fictícios não podem se contradizer** (ex.: dois documentos de compras com valores de aprovação
  diferentes confundem a IA). Use um documento por processo.
- **As 4 sugestões de perguntas** (`brand.suggestions`) precisam ter resposta nos documentos. Na MSM:
  "Quais serviços a MSM oferece?", "Em quais setores a MSM atua?", "Como faço para abrir um chamado de TI?" e
  "O que fazer quando uma máquina apresenta defeito?".
- **Tamanho:** os 9 documentos da MSM somam ~10 mil caracteres (~13 mil com as regras do prompt), bem abaixo do
  limite (`MAX_CONTEXT_CHARS`, 150 mil).

---

## 7. Lições aprendidas (não repetir)

Todas estas soluções **já estão no código-base**. A tabela explica o porquê, para ninguém desfazer. Linhas marcadas com *(prevenção)* não chegaram a acontecer em uso: foram encontradas em revisão ou testes.

| Problema ou risco | Causa | Solução no código |
| --- | --- | --- |
| Chat ficava em "Consultando os documentos…" e depois "conexão interrompida" | Causa provável: o Gemini 3.8 Flash demorava para começar a responder e a Vercel encerrava a função em 60 s, sem mensagem (resolvido com a solução ao lado) | Prazo de 15 s para o primeiro trecho (`GEMINI_FIRST_TOKEN_SECONDS`) com troca para o modelo reserva; prazo total de 52 s com mensagem clara; "ping" a cada 4 s |
| Só 20 perguntas por dia | No plano gratuito, o Gemini 3.8 Flash tinha 5/min e 20/dia; o 3.5 Flash-Lite, 15/min e 500/dia | Flash-Lite é o principal e o 3.8 Flash, o reserva (`lib/env.ts`) |
| Parâmetro ignorado / erro em modelos novos | Gemini 3.6+ descontinuou `temperature`; o 3.8 Flash não aceita raciocínio `minimal` | Sem `temperature`; raciocínio `low` |
| Cancelamento fora de hora *(prevenção)* | Hipótese levantada durante o travamento acima: `request.signal` pode disparar cedo em alguns ambientes | Cancelamento pelo `cancel()` do stream (`app/api/chat/route.ts`) |
| Pacote grande demais para a Vercel | `googleapis` completo tem ~250 MB | `@googleapis/drive` (~2 MB) |
| `pdf-parse` quebra no servidor | O `index.js` roda código de teste | Import de `pdf-parse/lib/pdf-parse.js` + `serverExternalPackages` + `outputFileTracingIncludes` (`next.config.ts`) |
| Fonte do corpo não aplicada | Variável da `next/font` estava no `<body>`, e o `font-sans` no `<html>` | Variáveis das fontes no `<html>` (`app/layout.tsx`) |
| Celular abria a tela inicial rolada para o fim | Rolagem automática rodava também sem mensagens | Tela vazia sempre do topo (`chat-app.tsx`) |
| Foto da entrada sumia no celular | Card ocupava a tela toda e o degradê era escuro demais | Card compacto e degradê mais claro no celular |
| Foto de fundo e ícones exigiam login | O middleware protegia tudo | Arquivos estáticos e `manifest.webmanifest` liberados no `matcher` |
| Fontes erradas ou de mais *(prevenção)* | Nome comum ("Contato") casaria com qualquer texto | Fontes vêm do marcador; nome só conta em itálico, negrito ou aspas (`lib/answer.ts`) |
| Linha "FONTES: 1" aparecendo *(prevenção)* | O modelo pode escrever o marcador fora do formato | Filtro no servidor + limpeza final no cliente |
| Chave do plano gratuito expõe dados | No gratuito, o Google pode usar o conteúdo (inclusive com revisão humana) | Demo só com documentos públicos ou fictícios; produção com IA paga |
| Vercel gratuita não serve para cliente | O plano Hobby é só para uso não comercial | Demo na Vercel; produção na Cloudflare (exige adaptação) ou Vercel Pro |
| Cota dividida entre demos | Limites do Gemini valem **por projeto do Google**, não por chave | Um projeto do Google Cloud (e uma chave) por cliente |

---

## 8. Configuração e publicação

### Demo (custo zero)

1. **Chave do Gemini:** em <https://aistudio.google.com/apikey>, **crie um projeto novo para cada cliente**
   (os limites são por projeto) e gere a chave. Os limites do projeto aparecem em
   <https://aistudio.google.com/rate-limit>.
2. **Vercel:** importe o repositório em <https://vercel.com/new> e cadastre as variáveis antes do deploy:

   | Variável | Valor |
   | --- | --- |
   | `APP_PASSWORD` | Senha da demo (sem ela, ninguém entra em produção) |
   | `GEMINI_API_KEY` | Chave do AI Studio |

   O padrão já usa `gemini-3.5-flash-lite` como principal e `gemini-3.8-flash` como reserva. Depois de mudar
   uma variável, faça **Redeploy**.
3. **Google Drive (opcional para a demo):** sem `DRIVE_FOLDER_ID`, o app lê `seed-docs/`. Para usar o Drive:
   conta de serviço com a Google Drive API ativada, pasta compartilhada com o e-mail dela como Leitor e as
   variáveis `DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY`. Passo a passo no README.
4. **Conferir:** abra `/api/diagnostico` logado. Cada modelo deve aparecer com `funcionou: true`. Não deixe
   essa página atualizando: cada acesso gasta 1 pergunta de cada modelo.

### Produção (depois da venda)

IA paga (privacidade e limites), hospedagem comercial (Cloudflare Workers, US$ 5/mês, exige adaptar o código;
ou Vercel Pro), login com contas da empresa, busca vetorial, histórico e relatórios no servidor. Ver seção 11.

---

## 9. Testes

**Rápidos (sempre antes de enviar):**

```bash
npm run lint
```

```bash
npm run build
```

**De ponta a ponta, sem chave e sem gastar cota** (Gemini simulado + navegador). Em um terminal:

```bash
node scripts/teste/gemini-simulado.mjs
```

Crie o `.env.local` de teste (não vai para o Git):

```bash
printf 'APP_PASSWORD=teste123\nGEMINI_API_KEY=chave-falsa\nGEMINI_BASE_URL=http://localhost:3999\n' > .env.local
```

```bash
npm run build && PORT=3100 npm run start
```

Em outro terminal:

```bash
SENHA=teste123 node scripts/teste/e2e.cjs
```

O teste verifica: entrada (senha errada e certa), sugestão com fontes, avaliação, pergunta sem resposta, erro de
limite com "Tentar novamente", histórico, base de conhecimento, abertura de documento, celulares (iPhone SE,
iPhone 13, Pixel 7) sem rolagem lateral, apagar histórico e sair. As capturas ficam em
`scripts/teste/capturas/`: **olhe as de entrada e de início no celular** para ajustar o degradê e o tamanho do
logo. Os cenários do Gemini simulado (limite, lentidão, chave inválida) estão no topo do arquivo.

Apague o `.env.local` de teste no fim.

**Com a chave real (antes da reunião):** faça as 4 sugestões, uma pergunta fora dos documentos (deve dizer que
não encontrou), uma de acompanhamento ("E se for urgente?") e teste o microfone no celular.

---

## 10. Roteiro de demonstração

1. **Entrar** com nome e senha: saudação personalizada.
2. Clicar numa **sugestão**: resposta em passos, com a **fonte**; clicar na fonte para abrir o documento.
3. **Pergunta de acompanhamento** ("E se for urgente?").
4. Perguntar **por voz** pelo celular.
5. Perguntar algo que **não está** nos documentos: o assistente diz que não encontrou e indica o responsável.
6. Abrir a **Base de conhecimento**, adicionar um documento novo no Drive (se configurado), clicar em
   **Atualizar agora** e perguntar sobre ele.

Ensaie uma vez antes, com a chave real, para conferir as respostas e os limites.

---

## 11. Custos e proposta (resumo interno)

Estimativa para ~3.500 perguntas por mês na versão final (~6 mil tokens de entrada e ~1 mil de saída por
pergunta), com os preços oficiais da Anthropic e câmbio de referência de R$ 5,50:

| Modelo (produção) | Por pergunta | A cada 1.000 perguntas | Por mês |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | ≈ R$ 0,006 | ≈ R$ 6 | ≈ R$ 21 |
| Claude Sonnet 5.5 | ≈ R$ 0,12 | ≈ R$ 121 | ≈ R$ 424 |

Duas estratégias de cobrança: **(1)** o cliente paga a IA e a hospedagem direto, nas contas dele (~R$ 49/mês
com Haiku + Cloudflare), e a UFABC Jr cobra implantação + sustentação; **(2)** mensalidade fixa à UFABC Jr,
que paga os fornecedores (custo × 3 de margem + suporte, com franquia). Recomendação: estratégia 1 com Haiku.
Detalhes no documento interno "Assistente MSM — custos de IA e estratégias de cobrança". Reconfirme preços e
câmbio antes de cada proposta.

O código já isola o provedor de IA em `lib/llm.ts`: para usar o Claude em produção, reescreva só esse arquivo
mantendo a interface (`streamAnswer`, `isLLMConfigured`, `diagnoseLLM`, `LLMError`).
