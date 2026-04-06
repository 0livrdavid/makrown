#!/bin/bash
# Uso: ./scripts/release.sh [patch|minor|major]
# Padrão: patch
#
# Exemplos:
#   ./scripts/release.sh          → 0.1.0 → 0.1.1
#   ./scripts/release.sh minor    → 0.1.0 → 0.2.0
#   ./scripts/release.sh major    → 0.1.0 → 1.0.0

set -e

# Help
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  echo "Uso: ./scripts/release.sh [patch|minor|major]"
  echo ""
  echo "Tipos de release:"
  echo "  patch  (padrão)  0.1.0 → 0.1.1"
  echo "  minor            0.1.0 → 0.2.0"
  echo "  major            0.1.0 → 1.0.0"
  echo ""
  echo "Requisitos:"
  echo "  - Estar na branch 'main'"
  echo "  - Sem mudanças pendentes (tudo commitado)"
  exit 0
fi

TYPE=${1:-patch}

if [[ "$TYPE" != "patch" && "$TYPE" != "minor" && "$TYPE" != "major" ]]; then
  echo "❌ Tipo inválido: '$TYPE'. Use: patch | minor | major"
  echo "   Use --help para mais informações."
  exit 1
fi

# Garante que está na branch main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "❌ Você precisa estar na branch 'main' para fazer um release. Branch atual: $BRANCH"
  exit 1
fi

# Garante que não há mudanças pendentes
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Há mudanças não commitadas. Faça commit antes de gerar um release."
  git status --short
  exit 1
fi

echo "🔄 Atualizando main..."
if ! git pull --rebase origin main; then
  echo "❌ Conflito ao fazer pull. Resolva o merge/rebase antes de continuar:"
  echo "   git rebase --abort   → cancela e volta ao estado anterior"
  echo "   git rebase --continue → após resolver os conflitos manualmente"
  exit 1
fi

# Versão atual
CURRENT=$(node -p "require('../package.json').version")
echo "📌 Versão atual: $CURRENT"

# Bump version (sem criar tag ainda)
npm version "$TYPE" --no-git-tag-version

NEW_VERSION=$(node -p "require('../package.json').version")
echo "🚀 Nova versão: $NEW_VERSION"

# Commit + tag
git add package.json package-lock.json
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Push
echo "📤 Enviando para o GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Release v$NEW_VERSION criado com sucesso!"
echo "🔗 Acompanhe o build em: https://github.com/0livrdavid/makrown/actions"
echo "📦 O .dmg estará disponível em: https://github.com/0livrdavid/makrown/releases"
