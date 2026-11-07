# Assistente MSM — MVP

Assistente interno com IA da **MSM Caldeiraria** (MSM Industrial Engineering, Ribeirão Pires/SP).
Os colaboradores perguntam por **texto ou voz** sobre processos, serviços, funções e procedimentos da
empresa, e o assistente responde **somente com base nos documentos de uma pasta do Google Drive**,
sempre citando de qual documento tirou a resposta. Arquivo novo ou alterado na pasta passa a ser usado
automaticamente, sem nenhum passo manual.

**Custo zero de operação:** Gemini pelo plano gratuito do Google AI Studio, Google Drive API (gratuita) e
plano gratuito da Vercel. Sem banco de dados e sem serviço de embeddings.

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Pré-requisitos](#pré-requisitos)
3. [Rodar em 2 minutos (modo de teste)](#rodar-em-2-minutos-modo-de-teste)
4. [Passo 1 — Chave gratuita do Gemini](#passo-1--chave-gratuita-do-gemini-google-ai-studio)
5. [Passo 2 — Conta de serviço e Google Drive API](#passo-2--conta-de-serviço-no-google-cloud-e-google-drive-api)
6. [Passo 3 — Pasta do Drive](#passo-3--pasta-do-google-drive)
7. [Variáveis de ambiente](#variáveis-de-ambiente)
8. [Rodar localmente](#rodar-localmente)
9. [Deploy na Vercel](#deploy-na-vercel)
10. [Como funciona](#como-funciona)
11. [Roteiro de demonstração](#roteiro-de-demonstração)
12. [Personalizar marca e sugestões](#personalizar-marca-e-sugestões)
13. [Solução de problemas](#solução-de-problemas)
14. [Limitações do MVP e próximos passos](#limitações-do-mvp-e-próximos-passos)
15. [Estrutura do projeto](#estrutura-do-projeto)

---

## Funcionalidades

- **Acesso simples:** senha única (`APP_PASSWORD`) e o nome do colaborador para personalizar a saudação.
- **Chat estilo ChatGPT:** lista de conversas à esquerda, respostas em streaming e em Markdown,
  passos numerados para procedimentos.
- **Fontes em toda resposta:** nome do documento com link para abrir no Google Drive.
- **Nunca inventa:** se a informação não estiver nos documentos, diz isso e sugere procurar o
  responsável pela área.
- **Voz:** ditado da pergunta em pt-BR (botão de microfone) e botão para ouvir a resposta.
- **Histórico no navegador** (`localStorage`) e avaliação 👍/👎 em cada resposta.
- **Página “Base de conhecimento”** (`/documentos`): arquivos da pasta com tipo, data, status
  (lido, erro, não suportado), botão **Atualizar agora** e **Abrir pasta no Drive**.
- **Responsivo e instalável:** funciona bem no celular e pode ser adicionado à tela inicial como um
  aplicativo (o pessoal da fábrica pode usar no próprio aparelho).
- **Modo de teste:** sem `DRIVE_FOLDER_ID`, lê os arquivos de `seed-docs/`; sem `GEMINI_API_KEY`,
  mostra os trechos mais relevantes dos documentos (sem IA), deixando isso claro na tela.

Tipos de arquivo lidos: **Google Docs**, **Google Planilhas** (primeira aba, como CSV),
**Google Apresentações**, **PDF** (com texto), **Word (.docx)**, **TXT**, **Markdown** e **CSV**.
Outros tipos aparecem como “não suportado”.

## Pré-requisitos

- **Node.js 20 ou superior** (recomendado 22 LTS) e npm.
- Uma **conta Google** (para o AI Studio, o Google Cloud e o Drive).
- Para o deploy: conta gratuita na **Vercel** e o código em um repositório no GitHub.

## Rodar em 2 minutos (modo de teste)

Funciona sem nenhuma configuração, lendo os documentos de `seed-docs/`:

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. Em desenvolvimento, sem `APP_PASSWORD`, a tela de entrada pede só o nome.
Sem a chave do Gemini, o chat responde no **modo de teste sem IA** (mostra os trechos mais relevantes).
Siga os passos abaixo para ligar a IA e o Google Drive.

## Passo 1 — Chave gratuita do Gemini (Google AI Studio)

1. Acesse <https://aistudio.google.com/apikey> e entre com uma conta Google.
2. Aceite os termos, se for o primeiro acesso.
3. Clique em **Create API key** (Criar chave de API). Se pedir, escolha ou crie um projeto do Google Cloud
   (pode ser o mesmo do Passo 2).
4. Copie a chave e coloque em `GEMINI_API_KEY`.

Não é preciso cadastrar cartão: sem faturamento ativado, o projeto fica no **plano gratuito**. O modelo
padrão é o `gemini-3.8-flash` (Flash mais recente do plano gratuito), com `gemini-3.5-flash-lite` como
reserva quando o limite do principal acaba. Os dois podem ser trocados por `GEMINI_MODEL` e
`GEMINI_FALLBACK_MODEL` (veja os modelos e limites em <https://ai.google.dev/gemini-api/docs/models> e no
painel de limites do AI Studio).

> **Atenção (privacidade):** no plano gratuito, os termos do Gemini API permitem que o Google use as
> perguntas, os documentos enviados como contexto e as respostas para melhorar os produtos dele,
> inclusive com leitura por revisores humanos. Para a demonstração com documentos de exemplo isso não é
> problema; para documentos internos reais em produção, use um plano pago (ou outro provedor, como o
> Claude — basta trocar `lib/llm.ts`). Confira os termos atuais em
> <https://ai.google.dev/gemini-api/terms>.

## Passo 2 — Conta de serviço no Google Cloud e Google Drive API

A conta de serviço é um “usuário robô” que só consegue ler a pasta que você compartilhar com ela.

1. Acesse <https://console.cloud.google.com/> e selecione (ou crie) um projeto no topo da tela.
2. **Ative a Google Drive API:** menu **APIs e serviços → Biblioteca**, busque **Google Drive API** e
   clique em **Ativar**.
3. **Crie a conta de serviço:** menu **IAM e administrador → Contas de serviço → Criar conta de serviço**.
   - Nome: `assistente-msm` → **Criar e continuar**.
   - Não precisa dar nenhum papel (role). Clique em **Continuar** e **Concluir**.
4. **Crie a chave:** abra a conta criada → aba **Chaves** → **Adicionar chave → Criar nova chave** →
   **JSON** → **Criar**. Um arquivo `.json` será baixado. **Guarde-o com cuidado e não o envie ao GitHub.**
5. Do arquivo JSON, copie:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (o texto inteiro, de `-----BEGIN PRIVATE KEY-----` até
     `-----END PRIVATE KEY-----\n`, com os `\n` como estão)

> Se a criação de chaves estiver bloqueada (“Service account key creation is disabled”), a organização
> do Google Workspace tem a política `iam.disableServiceAccountKeyCreation` ativa. Peça ao administrador
> para liberar no projeto ou use um projeto pessoal para o MVP.

## Passo 3 — Pasta do Google Drive

1. No Google Drive, crie uma pasta, por exemplo **Assistente MSM — Base de conhecimento**.
2. Envie para ela os arquivos de `seed-docs/` (podem ficar como `.md` ou ser convertidos em Google Docs;
   os dois formatos são lidos). Subpastas também são lidas.
3. Clique na pasta com o botão direito → **Compartilhar** → cole o e-mail da conta de serviço
   (`...@...iam.gserviceaccount.com`) → permissão **Leitor** → desmarque “Notificar” → **Compartilhar**.
4. Abra a pasta e copie o ID da URL: em `https://drive.google.com/drive/folders/1AbC...xyz`, o ID é
   `1AbC...xyz`. Coloque em `DRIVE_FOLDER_ID` (também aceita o link completo).

Pronto: a partir daí, qualquer arquivo adicionado ou alterado na pasta entra na base automaticamente.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. Todas estão documentadas no próprio arquivo.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `APP_PASSWORD` | Sim, em produção | Senha única de acesso. Em `npm run dev`, se vazia, entra sem senha. |
| `SESSION_SECRET` | Não | Segredo do cookie de sessão. Se vazio, deriva da senha. |
| `GEMINI_API_KEY` | Sim, para a IA | Chave do Google AI Studio. Sem ela, o chat fica no modo de teste sem IA. |
| `GEMINI_MODEL` | Não | Modelo principal. Padrão: `gemini-3.8-flash`. |
| `GEMINI_FALLBACK_MODEL` | Não | Modelo reserva em caso de limite (429). Padrão: `gemini-3.5-flash-lite`. `none` desativa. |
| `GEMINI_THINKING_LEVEL` | Não | Raciocínio dos modelos Gemini 3+: `minimal`, `low` (padrão), `medium`, `high` ou `default`. |
| `DRIVE_FOLDER_ID` | Sim, para o Drive | ID ou link da pasta. **Vazio = modo de teste lendo `seed-docs/`.** |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Com o Drive | E-mail da conta de serviço. |
| `GOOGLE_PRIVATE_KEY` | Com o Drive | Chave privada da conta de serviço (`private_key` do JSON). |
| `MAX_CONTEXT_CHARS` | Não | Máximo de caracteres de documentos por pergunta. Padrão: `150000`. |
| `DRIVE_REFRESH_SECONDS` | Não | Intervalo entre verificações da pasta. Padrão: `120`. |

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha os valores
npm run dev                  # http://localhost:3000
```

Outros comandos:

```bash
npm run build   # build de produção
npm run start   # roda o build de produção (exige APP_PASSWORD)
npm run lint    # verificação de código
```

No `.env.local`, a `GOOGLE_PRIVATE_KEY` vai **entre aspas duplas, em uma linha**, com os `\n` literais,
exatamente como aparece no JSON:

```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n...\n-----END PRIVATE KEY-----\n"
```

## Deploy na Vercel

1. Envie o projeto para um repositório no GitHub (o `.env.local` já é ignorado pelo Git).
2. Em <https://vercel.com/new>, clique em **Import** no repositório. O framework **Next.js** é detectado
   automaticamente; não mude os comandos de build.
3. Abra **Environment Variables** e cadastre as variáveis da tabela acima (no mínimo `APP_PASSWORD`,
   `GEMINI_API_KEY`, `DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY`).
4. **Como colar a `GOOGLE_PRIVATE_KEY`:** copie o valor do campo `private_key` do JSON (sem as aspas
   externas) e cole no campo *Value*. As duas formas funcionam, porque o app converte automaticamente:
   - **em uma linha, com `\n` literais** (exatamente como está no JSON):
     `-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n`
   - **com quebras de linha reais** (a Vercel aceita valores com várias linhas).
5. Clique em **Deploy**. Ao terminar, abra a URL `https://<seu-projeto>.vercel.app`.
6. Para mudar uma variável depois: **Settings → Environment Variables**, altere e faça **Redeploy**.

Observações sobre o plano gratuito da Vercel:

- As funções têm tempo máximo de execução; o chat usa `maxDuration = 60` segundos, suficiente para as
  respostas.
- O cache dos documentos fica **na memória de cada instância**. Numa instância nova (após um tempo sem
  uso), a primeira pergunta lê a pasta inteira e pode demorar alguns segundos a mais.

## Como funciona

```
Navegador ──► /api/chat ──► Base de conhecimento (cache em memória) ──► Google Drive API
   ▲                │                                                    (ou seed-docs/)
   │                └──► Seleção de contexto (tudo, ou BM25 se passar do limite)
   │                └──► lib/llm.ts → Gemini (streaming)
   └──── texto em streaming + fontes (NDJSON)
```

- **Atualização automática:** a cada pergunta, se a última verificação da pasta tiver mais de 2 minutos,
  o app lista os arquivos de novo e reprocessa **só os que mudaram** (chave `fileId + modifiedTime`).
  Arquivos removidos saem da base. O botão **Atualizar agora** força a releitura na hora.
- **Contexto:** se todos os documentos couberem em `MAX_CONTEXT_CHARS`, eles vão inteiros para o
  Gemini (janela de contexto grande), cada um delimitado com nome e link. Se passar do limite, uma busca
  por palavras-chave (**BM25 em memória**, por trechos) escolhe os trechos mais relevantes. No produto
  final, isso vira busca vetorial (ver `lib/retrieval.ts`).
- **Fontes:** o modelo indica os documentos usados num marcador escondido no fim da resposta; o app
  também reconhece documentos citados pelo nome no texto. As fontes aparecem como links abaixo da resposta.
- **Conversa:** as últimas 6 mensagens vão junto com a pergunta, para perguntas de acompanhamento
  (“e se for urgente?”).
- **Provedor de IA isolado:** tudo o que é específico do Gemini fica em `lib/llm.ts`, com a interface
  `streamAnswer(messages, context)`. Para usar o Claude ou outro modelo no projeto final, basta
  reescrever esse arquivo.
- **Limite gratuito (HTTP 429):** o app tenta o modelo reserva automaticamente; se os dois estiverem no
  limite, mostra uma mensagem amigável com o botão **Tentar novamente**.

## Roteiro de demonstração

Sugestão para apresentar ao cliente (5 minutos):

1. **Entrar** com a senha e o nome → saudação personalizada.
2. Clicar numa **sugestão** (ex.: “Como faço para abrir um chamado de TI?”) → resposta em passos
   numerados e a **fonte** com link. Clicar na fonte para abrir o documento no Drive.
3. Fazer uma **pergunta de acompanhamento** (“E se for urgente?”).
4. Perguntar **por voz** pelo celular (botão de microfone).
5. Perguntar algo que **não está** nos documentos (ex.: “Qual o faturamento da MSM?”) → o assistente diz
   que não encontrou e sugere procurar o responsável. **Não inventa.**
6. Abrir **Base de conhecimento**, mostrar a pasta no Drive, **adicionar um documento novo**, clicar em
   **Atualizar agora** e perguntar sobre ele no chat.

Dica: teste o roteiro uma vez antes da reunião para “aquecer” o cache e conferir os limites da chave.

## Personalizar marca e sugestões

- **Cores, nome do produto, textos e sugestões de perguntas:** `config/brand.ts` (único arquivo de marca;
  as cores viram variáveis CSS `--brand-*`).
- **Logo:** `public/logo.png` (logo completo) e `public/logo-mark.png` (só as letras “MSM”, usado no
  avatar do assistente). Os ícones do app ficam em `app/icon.png`, `app/apple-icon.png` e `public/icons/`.
- **Foto de fundo da tela de entrada:** `public/login-bg.jpg` (skid de geradores de nitrogênio, do site da
  MSM), com sobreposição em degradê azul. Para trocar, substitua o arquivo ou mude `loginBackground` em
  `config/brand.ts`.
- **Usar como aplicativo no celular:** abra o site no navegador do celular e escolha **Adicionar à tela
  inicial** (Safari: botão Compartilhar; Chrome: menu ⋮). Ele abre em tela cheia, com o ícone da MSM.
- **Prompt de sistema e regras:** `lib/prompt.ts`.

### Documentos de exemplo

A pasta `seed-docs/` traz três documentos **fictícios**, marcados como exemplo: *Processo de compras*,
*Onboarding de colaboradores* e *Abertura de chamado de TI*. As sugestões de perguntas da tela inicial
foram escritas para eles. Ao trocar pelos documentos reais da MSM (institucional, serviços, setores,
cases, contato), atualize `suggestions` em `config/brand.ts` — por exemplo: “Quais serviços a MSM
oferece?” e “Em quais setores a MSM atua?”.

## Solução de problemas

| Sintoma | Causa provável e solução |
| --- | --- |
| “Limite de uso gratuito da IA” | Cota por minuto/dia do plano gratuito. Aguarde 1 minuto. Veja os limites no painel do AI Studio. |
| “Chave da IA inválida” | `GEMINI_API_KEY` errada ou revogada. Gere outra no AI Studio. |
| “Pasta não encontrada” / “Sem permissão” | Pasta não compartilhada com o e-mail da conta de serviço, ou `DRIVE_FOLDER_ID` errado. |
| “Google Drive API não está ativada” | Ative a API no mesmo projeto da conta de serviço (Passo 2). |
| “Credenciais da conta de serviço inválidas” | `GOOGLE_PRIVATE_KEY` incompleta ou com quebras de linha erradas; ou e-mail errado. |
| Arquivo com status “Erro: nenhum texto encontrado” | PDF escaneado (imagem). Use um PDF com texto ou um Google Docs. |
| Botão de microfone não aparece | O navegador não suporta ditado (ex.: Firefox). Use Chrome, Edge ou Safari. Em produção, o site precisa de HTTPS (a Vercel já usa). |
| Arquivo novo não aparece | Aguarde até 2 minutos ou clique em **Atualizar agora** na página Base de conhecimento. |
| Planilha lida pela metade | A exportação CSV do Drive inclui só a **primeira aba**. Separe abas importantes em arquivos. |

## Limitações do MVP e próximos passos

- **Busca:** BM25 por palavras-chave quando a base cresce; no produto final, **busca vetorial**
  (embeddings) com indexação incremental.
- **Cache em memória** por instância do servidor; no produto final, índice persistente.
- **Acesso:** senha única compartilhada; no produto final, login com as contas Google da empresa (SSO).
- **Histórico e avaliações** ficam só no navegador; no produto final, salvos no servidor para gerar
  relatórios (perguntas mais feitas, respostas mal avaliadas, lacunas na documentação).
- **Modelo de IA:** plano gratuito do Gemini, com limites de uso e termos de dados do plano gratuito.

## Estrutura do projeto

```
app/
  (app)/page.tsx              # chat (tela principal)
  (app)/documentos/           # página "Base de conhecimento" e visualizador do modo de teste
  entrar/page.tsx             # tela de entrada (senha + nome)
  api/chat/route.ts           # pergunta → resposta em streaming + fontes
  api/documents/route.ts      # lista da base (?refresh=1 força a releitura)
  api/login, api/logout       # sessão por cookie
components/                   # interface (chat, documentos, cabeçalho, shadcn/ui)
config/brand.ts               # identidade visual e sugestões de perguntas
lib/
  llm.ts                      # provedor de IA (Gemini) — troque aqui pelo Claude
  llm-offline.ts              # modo de teste sem IA
  prompt.ts                   # prompt de sistema e montagem do contexto
  drive.ts                    # Google Drive: listagem recursiva e extração de texto
  local-docs.ts               # modo de teste: leitura de seed-docs/
  knowledge.ts                # cache em memória (fileId + modifiedTime)
  retrieval.ts                # seleção de contexto (BM25)
  auth.ts                     # senha única e cookie de sessão assinado
middleware.ts                 # protege as páginas e APIs
seed-docs/                    # documentos de exemplo
```

Tecnologias: Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, `@google/genai`,
`@googleapis/drive` (módulo oficial do Drive da família `googleapis`, bem menor que o pacote completo,
o que mantém a função dentro do limite de tamanho da Vercel), `pdf-parse` e `mammoth`.
