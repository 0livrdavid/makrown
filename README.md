# Makrown

> Editor de Markdown desktop com suporte nativo a servidores VPS via SSH.

Makrown é um editor focado em produtividade para quem trabalha com arquivos Markdown — localmente ou em servidores remotos. Abre pastas, edita com WYSIWYG, visualiza diff antes de enviar e sincroniza com sua VPS sem precisar de nenhuma configuração no servidor.

---

## Download

**[→ Baixar a última versão](https://github.com/0livrdavid/makrown/releases/latest)**

| Plataforma | Arquivo |
|------------|---------|
| macOS (Apple Silicon) | `makrown-x.x.x-arm64.dmg` |
| macOS (Intel) | `makrown-x.x.x-x64.dmg` |
| Linux | `makrown-x.x.x-amd64.AppImage` |
| Windows | `makrown-x.x.x-setup.exe` |

> Não é necessário instalar Node.js, Git ou qualquer dependência. Só baixar e abrir.

---

## Funcionalidades

### Editor
- Edição WYSIWYG com suporte a Markdown completo (GFM, LaTeX, tabelas, código)
- Múltiplas abas abertas simultaneamente
- Visualização de preview renderizado ao lado
- Indicador de arquivo modificado (•) nas abas
- Drafts automáticos — seu trabalho nunca é perdido

### Pastas e Navegação
- Abre qualquer pasta local como projeto
- Árvore de arquivos com filtro inteligente (ignora `node_modules`, `.git`, etc.)
- Busca por nome de arquivo e por conteúdo
- Criar, renomear e deletar arquivos e pastas

### VPS / SSH
- Conexão direta via SSH/SFTP — zero configuração no servidor
- Perfis de conexão salvos — conecte com um clique
- Reconexão automática em caso de queda (3 tentativas)
- Indicador de status da conexão em tempo real
- Auto-save configurável (envia automaticamente para a VPS ao salvar)

### Diff e Envio
- Painel de alterações na sidebar — veja o que mudou antes de enviar
- Diff visual lado a lado (modificado vs. original)
- Envio seletivo por arquivo ou em lote
- Alterações persistidas localmente mesmo após fechar o app

### Personalização
- Fonte, tamanho e espaçamento configuráveis
- Zoom global com `Cmd +` / `Cmd -`
- Interface 100% dark

---

## Capturas de tela

> Em breve.

---

## Para desenvolvedores

Se quiser rodar o projeto localmente ou contribuir:

```bash
git clone https://github.com/0livrdavid/makrown.git
cd makrown
npm install
npm run dev
```

Para gerar o build:

```bash
npm run package
```

**Requisitos:** Node.js 22+, macOS / Linux / Windows

### Stack

| Camada | Tecnologia |
|--------|------------|
| Desktop | Electron |
| Frontend | React + TypeScript |
| Editor | Milkdown (ProseMirror) |
| Conexão VPS | ssh2 |
| Estilização | Tailwind CSS |
| Build | electron-builder |

---

## Licença

MIT
