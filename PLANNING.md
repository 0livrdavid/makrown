# Makrown — Planejamento do Projeto

## Visao Geral

**Makrown** e um leitor e editor de markdown desktop.
Funciona como um Obsidian — abre pastas locais, edita e renderiza markdown.
Futuramente, conecta diretamente a servidores VPS via SSH/SFTP sem configuracao no servidor.

---

## Stack Definida

| Camada            | Tecnologia              |
| ----------------- | ----------------------- |
| Runtime desktop   | Electron                |
| Frontend          | React + TypeScript      |
| Renderizacao MD   | react-markdown / remark |
| Conexao VPS       | ssh2 (Node.js)          |
| Editor de texto   | CodeMirror 6            |
| Estilizacao       | Tailwind CSS            |
| Build/Distribuicao| electron-builder        |

---

## Arquitetura

```
Electron App
├── Main Process (Node.js)
│   ├── Operacoes de filesystem (local)
│   ├── Gerenciamento de conexoes SSH (futuro)
│   ├── Operacoes SFTP (futuro)
│   └── IPC handlers (ponte com o Renderer)
│
├── Renderer Process (React)
│   ├── Arvore de arquivos (file tree sidebar)
│   ├── Editor (CodeMirror 6)
│   ├── Preview de Markdown (react-markdown)
│   ├── Gerenciamento de abas
│   └── Tela de conexao SSH (futuro)
│
└── Preload Script
    └── API segura exposta via contextBridge
```

**Abordagem:** O app comeca funcionando 100% local (filesystem nativo).
A camada de acesso a arquivos sera abstraida para que, ao adicionar SSH/SFTP,
o restante do app nao precise mudar.

---

## Fases do Projeto

### Fase 1 — Setup e Estrutura Base ✅

**Objetivo:** Projeto Electron funcionando com React, pronto para desenvolvimento.

- [x] Inicializar repositorio git
- [x] Configurar projeto Electron com React + TypeScript
- [x] Configurar Tailwind CSS (migrado para v3 + PostCSS para compatibilidade com electron-vite)
- [x] Estruturar pastas do projeto (main, renderer, preload, shared)
- [x] Configurar build basico com electron-builder
- [x] Criar window principal com hot reload funcionando
- [x] Validar que o ciclo dev funciona (npm run dev abre o app)

**Entregavel:** App Electron abre uma janela com React renderizando.

---

### Fase 2 — Acesso ao Filesystem Local ✅

**Objetivo:** Abrir uma pasta local e ler/escrever arquivos via Node.js.

- [x] Implementar dialog nativo para selecionar pasta (electron dialog.showOpenDialog)
- [x] Criar modulo de filesystem no Main Process (listDir, readFile, writeFile, createFile, createDir, rename, delete)
- [x] Criar interface/abstraction layer para operacoes de arquivo (facilitar futuro SFTP)
- [x] Criar IPC handlers para todas as operacoes de arquivo
- [x] Expor API segura via preload/contextBridge
- [x] Salvar ultima pasta aberta (reabrir ao iniciar o app)

**Entregavel:** App abre pasta local, le e escreve arquivos pelo Main Process.

---

### Fase 3 — Arvore de Arquivos (File Tree) ✅

**Objetivo:** Sidebar com navegacao nos arquivos da pasta aberta.

- [x] Componente de sidebar com arvore de diretorios
- [x] Carregar raiz da pasta selecionada
- [x] Expandir/colapsar pastas (lazy loading)
- [x] Icones diferenciados para pastas e arquivos .md
- [x] Filtrar para mostrar apenas arquivos .md (com opcao de ver todos via botao Filter)
- [x] Click em arquivo abre no editor
- [x] Indicador de carregamento ao navegar pastas grandes
- [x] Criar novo arquivo .md
- [x] Criar nova pasta
- [x] Renomear arquivo/pasta
- [x] Deletar arquivo/pasta (com confirmacao)
- [x] Ordenacao: pastas primeiro, depois arquivos, alfabetico

**Entregavel:** Sidebar funcional navegando arquivos locais.

---

### Fase 4 — Editor de Markdown ✅

**Objetivo:** Editor funcional para editar arquivos .md.

- [x] Integrar Milkdown Crepe (WYSIWYG, substituiu CodeMirror 6)
- [x] Syntax highlighting para markdown e blocos de codigo (CodeMirror interno do Crepe)
- [x] Carregar conteudo do arquivo no editor
- [x] Salvar arquivo (Cmd+S / Ctrl+S)
- [x] Indicador de arquivo modificado (unsaved changes — ponto indigo na aba)
- [x] Sistema de abas (multiplos arquivos abertos)
- [x] Fechar abas individualmente
- [x] Modo Editor raw (textarea com markdown puro, mostra # e sintaxe)

**Entregavel:** Usuario edita markdown local com experiencia fluida.

---

### Fase 5 — Preview de Markdown ✅

**Objetivo:** Renderizar markdown com tres modos de visualizacao.

- [x] Integrar react-markdown no renderer
- [x] Preview atualiza em tempo real conforme digitacao
- [x] Suporte a GFM (GitHub Flavored Markdown): tabelas, checkboxes, code blocks
- [x] Syntax highlighting em blocos de codigo (rehype-highlight)
- [x] Tres modos: Preview (WYSIWYG Milkdown), Editor (raw markdown), Visualize (renderizado)
- [x] Toggle entre modos na barra de acoes

**Entregavel:** Preview renderizado com alternancia entre modos.

---

### Fase 6 — Busca ✅

**Objetivo:** Buscar conteudo nos arquivos markdown da pasta aberta.

- [x] Busca por nome de arquivo (Cmd+P) — modal com debounce e navegacao por teclado
- [x] Busca full-text no conteudo dos arquivos (Cmd+Shift+F) — painel com excerpts e numeros de linha
- [x] Exibir resultados com preview do trecho encontrado (highlight do termo)
- [x] Click no resultado abre o arquivo no editor
- [x] Atalho de teclado para busca (Cmd+P para arquivo, Cmd+Shift+F para conteudo)

**Entregavel:** Busca funcional por nome e conteudo.

---

### Fase 7 — Filtragem de Diretorios ✅

**Objetivo:** Sistema de ignore para ocultar pastas/arquivos irrelevantes da arvore.

- [x] Ignorar pastas por padrao: node_modules, .git, .next, dist, build, __pycache__, .venv, vendor (toggle)
- [x] Campo de texto livre para padroes de ignore customizados (suporta arquivos e pastas, estilo glob)
- [x] Modal de configuracao de filtros por pasta
- [x] Filtro salvo no localStorage por pasta (cada pasta tem seu proprio filtro)
- [x] Toggle: mostrar apenas .md / mostrar todos os arquivos
- [x] Toggle: ocultar arquivos ocultos (ponto)
- [x] Toggle: ocultar pastas vazias (com peek recursivo para avaliar subpastas)
- [x] Tela de loading com barra de progresso ao aplicar filtros (util para VPS)
- [x] Select de pastas recentes no footer da sidebar
- [x] Filtro aplicado imediatamente ao salvar, sem precisar expandir pastas

**Entregavel:** Arvore de arquivos limpa, sem pastas irrelevantes.

---

### Fase 8 — Polish e UX ✅

**Objetivo:** Refinar a experiencia do usuario.

- [x] Watch de filesystem — arvore atualiza automaticamente quando arquivos mudam fora do app
  - `fs.watch` recursivo no Main Process, debounce 300ms, emite `fs:changed` com `parentDir`
  - `watchRefresh` no `useFileTree` faz merge inteligente preservando estado expandido
  - Sidebar registra/cancela watcher ao trocar pasta
- [x] Barra de status inferior (arquivo atual, contagem de palavras/caracteres)
  - `StatusBar` com caminho relativo, palavras e caracteres (useMemo)
- [x] Tratamento de erros amigavel (toasts/notificacoes de sucesso e falha)
  - `useToast` hook + `ToastContext` + `ToastContainer`
  - Toasts em: salvar, abrir arquivo, criar/renomear/excluir na sidebar
- [x] Menu nativo do app (File, Edit, View) com atalhos integrados ao OS
  - `buildMenu` com macOS app menu, File, Edit, View
  - Atalhos: Cmd+O, Cmd+S, Cmd+1/2/3, Cmd+P, Cmd+Shift+F
- [~] Tema claro — descartado
- [x] Fonte configuravel (familia, tamanho) no editor
- [x] Atalhos de teclado globais documentados (painel de ajuda)

**Entregavel:** App com UX polida e pronta para uso diario.

---

### Fase 9 — Conexao SSH/SFTP ✅

**Objetivo:** Conectar a uma VPS via SSH e operar arquivos remotos como se fossem locais.

- [x] Instalar e configurar lib `ssh2`
- [x] Criar modulo de conexao SSH no Main Process (`src/main/filesystem/remote.ts`)
- [x] Implementar autenticacao por senha
- [x] Implementar autenticacao por chave SSH (~/.ssh/id_rsa)
- [x] Implementar o mesmo interface/abstraction layer do filesystem local para SFTP
- [x] IPC handlers para: conectar, desconectar, status da conexao (`src/main/ipc/ssh.ts`)
- [x] Tratar erros de conexao (timeout, auth falha, host unreachable)
- [x] Criar tela de conexao — modal 2 etapas: credenciais + browser de diretorio remoto
- [x] Salvar conexoes recentes em localStorage (max 5, deduplicado por host+porta+usuario)
- [x] Listar/editar conexoes salvas — edicao via modal pre-preenchido (botao lapiz no dropdown)
- [x] Conectar direto a VPS recente sem abrir modal
- [x] Aplicar mesma filtragem de diretorios (Fase 7) nos arquivos remotos
- [x] Reconexao automatica em caso de queda (3 tentativas: 2s/5s/10s)
- [x] Indicador visual de status da conexao (dot colorido no FolderSelect)

**Entregavel:** App funciona com arquivos remotos via SSH, mesma experiencia que local.

---

### Fase 10 — Build e Distribuicao

**Objetivo:** Gerar executaveis para distribuicao.

- [ ] Configurar electron-builder para macOS (.dmg)
- [ ] Configurar electron-builder para Linux (.AppImage, .deb)
- [ ] Configurar electron-builder para Windows (.exe, .msi) — se desejado
- [ ] Icone do app
- [ ] Auto-update (electron-updater) — opcional
- [ ] README do projeto

**Entregavel:** Binarios prontos para instalacao.

---

### Fase 11 — Git Integrado

**Objetivo:** Interface visual completa de Git dentro do Makrown, inspirada no PHPStorm.

- [ ] **Commit panel** — painel lateral com arquivos modificados/staged, campo de mensagem e botão de commit
  - Listagem de `git status` (modified, untracked, staged, deleted)
  - Stage/unstage individual ou em lote
  - Escrever mensagem de commit com histórico de mensagens recentes
  - Commitar via `git commit`
- [ ] **Push / Pull / Fetch** — botões na toolbar ou painel Git
  - `git push origin <branch>`
  - `git pull --rebase origin <branch>`
  - Indicador de "N commits à frente / N commits atrás"
- [ ] **Gerenciamento de branches**
  - Listar branches locais e remotas
  - Criar nova branch a partir da atual
  - Trocar de branch (com aviso se houver mudanças não commitadas)
  - Merge e rebase de branches com feedback visual
  - Deletar branch local/remota
- [ ] **Log / Histórico de commits**
  - Timeline de commits com hash, autor, data e mensagem
  - Expandir commit para ver diff das alterações
  - Filtro por branch, autor ou mensagem
- [ ] **Blame** — ver quem escreveu cada linha do arquivo atual
  - Integração na view do editor (coluna lateral com autor + data + hash)
  - Click no blame abre o commit correspondente no log
- [ ] **Conflict resolver** — interface visual para resolução de conflitos
  - Exibe os três painéis: LOCAL / BASE / REMOTE
  - Botões por hunk: aceitar local, aceitar remote, aceitar ambos
  - Botão "Marcar como resolvido" ao concluir
  - Integração com o DiffView já existente

**Dependências técnicas:**
- `simple-git` (Node.js) no Main Process para executar comandos git
- IPC handlers para cada operação (`git:status`, `git:stage`, `git:commit`, `git:push`, etc.)
- Novo painel lateral "Git" na Sidebar (alternativo ao painel de arquivos)

**Entregável:** Fluxo completo de Git (status → stage → commit → push → log) sem sair do app.

---

## Para Pensar / Backlog de Ideias

Itens levantados durante o desenvolvimento que ainda nao tem fase definida.
Nao sao compromissos — sao candidatos para avaliar em momentos de planejamento.

### UX & Editor
- **Fonte configuravel no editor** — familia (ex: monospace, serif) e tamanho; persistir nas preferencias do usuario
- **Icones por tipo de arquivo** — `.md` diferente de `.txt`, imagens, PDFs etc. na arvore
- **Indicador de arquivo nao salvo na arvore** — dot colorido ao lado do nome do arquivo (alem do dot na aba)
- **Acoes inline na arvore no hover** — botoes de rename/delete aparecem ao passar o mouse, sem precisar de clique direito
- **Micro-animacoes na arvore** — transicao suave no expand/collapse de pastas
- **Scrollbar customizada** — scrollbar fina e discreta para combinar com o tema escuro

### Tema
- **Tema claro** — ja listado na Fase 8, mas merece planejamento separado pois afeta todos os componentes

### SSH / VPS
- **Auto-reconexao em caso de queda** — detectar desconexao e tentar reconectar automaticamente antes de mostrar erro
- **Indicador de latencia/status de conexao** — badge sutil na sidebar quando conectado a VPS

### Diff & Merge
- **Merge por hunk no DiffView** — no painel de diff, permitir aceitar ou reverter blocos de mudanca individualmente:
  - Seta esquerda → direita por hunk: aceita aquela mudanca pontual (confirma a edicao no original)
  - Seta direita → esquerda por hunk: reverte aquela mudanca pontual (restaura o trecho original)
  - Botao "Aceitar tudo": confirma todas as mudancas (equivalente ao Enviar atual)
  - Botao "Reverter tudo": descarta todas as edicoes e restaura o conteudo original
  - Requer refatoracao do algoritmo `computeLineDiff` para agrupar linhas alteradas em **hunks contiguos**

### Editor
- **Painel de atalhos de teclado** — modal ou overlay com todos os atalhos do app documentados

---

## Prioridade do MVP

As fases 1 a 7 compoem o **MVP funcional**:
um app desktop que abre pastas locais, navega arquivos, edita markdown, renderiza preview,
busca por nome e conteudo, e filtra a arvore de forma inteligente.

| Fase   | Escopo              | Status            |
| ------ | ------------------- | ----------------- |
| 1 a 7  | MVP local completo  | ✅ Concluido      |
| 8      | Polish e UX         | ✅ Concluido      |
| 9      | Conexao SSH/SFTP    | ✅ Concluido      |
| 10     | Distribuicao        | ⬜ Nao iniciado   |
| 11     | Git Integrado       | ⬜ Nao iniciado   |

---

## Decisoes Tecnicas Registradas

| Decisao                        | Escolha              | Motivo                                          |
| ------------------------------ | -------------------- | ----------------------------------------------- |
| Plataforma                     | Desktop (Electron)   | Node.js no backend, dev ja conhece o ecosistema |
| Abordagem inicial              | Filesystem local     | Validar UX antes de adicionar complexidade SSH   |
| Conexao com VPS                | SSH/SFTP direto      | Zero config no servidor                         |
| Framework frontend             | React + TypeScript   | Dev ja trabalha com Next.js                     |
| Editor de texto                | Milkdown Crepe       | WYSIWYG ProseMirror-based, experiencia Typora   |
| Renderizacao markdown          | react-markdown       | Simples, composable, ecossistema remark/rehype  |
| Estilizacao                    | Tailwind CSS         | Rapido, utility-first                           |
| Armazenamento local            | localStorage + prefs | Filtros por pasta, recentes, ultima pasta aberta|
| Abstraction layer de arquivos  | Interface unica      | Mesmo contrato para local e SFTP                |
| Filtragem de arvore            | shouldShowNode + peek recursivo | Avalia pastas vazias carregando filhos sob demanda |
| Loading screen                 | Fixed overlay + progress bar real | Preparado para latencia de VPS/SSH  |

---

## Riscos e Mitigacoes

| Risco                                    | Mitigacao                                        |
| ---------------------------------------- | ------------------------------------------------ |
| Latencia SFTP em arquivos grandes        | Limitar preview a arquivos < 1MB no MVP          |
| Perda de conexao durante edicao          | Buffer local + retry de save                     |
| Conflito de edicao (outro editor aberto) | Fora do escopo do MVP, alertar no futuro         |
| Performance da arvore com muitos arquivos| Lazy loading de subpastas + filtragem de ignore  |
| Seguranca de credenciais SSH             | Usar keychain do OS ou armazenar encriptado      |
| Pastas com milhares de arquivos          | Filtragem por padrao + paginacao se necessario   |
