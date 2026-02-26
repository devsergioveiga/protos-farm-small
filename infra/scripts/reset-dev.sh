#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# reset-dev.sh — Destrói e recria o ambiente dev
# ──────────────────────────────────────────────

COMPOSE_FILE="docker-compose.yml"
HEALTH_TIMEOUT=120  # segundos
POLL_INTERVAL=3     # segundos

# ── Cores ────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERRO]${NC}  $*"; }

# ── 1. Timestamp de início ───────────────────
START_TIME=$(date +%s)
info "Iniciando reset do ambiente dev — $(date '+%Y-%m-%d %H:%M:%S')"

# ── 2. Validações iniciais ───────────────────
if ! command -v docker &>/dev/null; then
  error "Docker não encontrado. Instale o Docker antes de continuar."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon não está rodando. Inicie o Docker e tente novamente."
  exit 1
fi

# Garante que estamos na raiz do projeto (onde está o docker-compose.yml)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f "$COMPOSE_FILE" ]; then
  error "Arquivo $COMPOSE_FILE não encontrado em $PROJECT_ROOT"
  exit 1
fi

# ── 3. Derrubar containers e remover volumes ─
info "Derrubando containers e removendo volumes..."
docker compose down -v --remove-orphans

# ── 4. Subir serviços ────────────────────────
info "Subindo serviços..."
docker compose up -d

# ── 5. Aguardar healthchecks ─────────────────
info "Aguardando healthchecks (timeout: ${HEALTH_TIMEOUT}s)..."

SERVICES=$(docker compose ps --format '{{.Name}}')
ELAPSED=0

while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT" ]; do
  ALL_HEALTHY=true

  for SERVICE in $SERVICES; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$SERVICE" 2>/dev/null || echo "no-healthcheck")

    if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "no-healthcheck" ]; then
      continue
    fi

    ALL_HEALTHY=false
    break
  done

  if $ALL_HEALTHY; then
    break
  fi

  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  printf "\r  Aguardando... %ds / %ds" "$ELAPSED" "$HEALTH_TIMEOUT"
done

echo "" # nova linha após o progresso

if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT" ]; then
  error "Timeout: serviços não ficaram healthy em ${HEALTH_TIMEOUT}s"
  docker compose ps
  exit 1
fi

# ── 6. Status final ──────────────────────────
END_TIME=$(date +%s)
TOTAL=$((END_TIME - START_TIME))
MINUTES=$((TOTAL / 60))
SECONDS=$((TOTAL % 60))

echo ""
info "Ambiente dev recriado com sucesso!"
info "Tempo total: ${MINUTES}m ${SECONDS}s"
echo ""
docker compose ps
