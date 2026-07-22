#!/usr/bin/env bash
# Chuẩn bị VPS lần đầu để pipeline CI/CD deploy được. Chạy trên VPS, quyền root:
#
#   curl -fsSL https://raw.githubusercontent.com/Theanhvu1501/hackathon-scoring/master/scripts/vps-bootstrap.sh | bash
#
# Hoặc kèm public key của CI để cài luôn quyền deploy:
#
#   bash vps-bootstrap.sh "ssh-ed25519 AAAA... hackathon-ci"
#
# Script idempotent — chạy lại nhiều lần không sao, đã có thì bỏ qua.
set -euo pipefail

REPO="${REPO:-https://github.com/Theanhvu1501/hackathon-scoring.git}"
APP_DIR="${APP_DIR:-/opt/hackathon-scoring}"
CI_PUBKEY="${1:-}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ── 0. Preflight ─────────────────────────────────────────────────────────
# VPS này còn ít đĩa và đang chạy 4 site production khác. Build Docker cần
# khoảng 5-6GB; hết đĩa giữa chừng sẽ kéo sập cả những site kia.
FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
log "Đĩa trống: ${FREE_GB}GB"
if [ "$FREE_GB" -lt 8 ]; then
  PM2_LOGS=$(du -sh /root/.pm2/logs 2>/dev/null | cut -f1)
  echo "!! Cần ít nhất 8GB trống để build. Log pm2 đang chiếm ${PM2_LOGS:-?}."
  echo "   Giải phóng bằng:  pm2 flush"
  echo "   Rồi chạy lại script này."
  exit 1
fi

# Các port đã bị app pm2 khác chiếm — app này dùng 3100.
if ss -tln 2>/dev/null | grep -q ':3100 '; then
  echo "!! Port 3100 đã bị chiếm. Đổi port trong docker-compose.yml và nginx vhost."
  exit 1
fi

# ── 1. Docker ────────────────────────────────────────────────────────────
# Không dùng `apt install docker.io`: repo mặc định của Ubuntu 20.04 cho bản
# Docker cũ, không có plugin `docker compose` (v2) mà compose file này cần.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  log "Docker + compose plugin đã có, bỏ qua"
else
  log "Thêm repo Docker chính thức"
  # Chỉ dùng get.docker.com để cấu hình repo rồi bỏ qua bước cài của nó:
  # trên Ubuntu 20.04 (focal) script cố cài `docker-model-plugin` không tồn tại
  # cho bản này, khiến apt fail và KHÔNG cài được gói nào cả.
  curl -fsSL https://get.docker.com | sh || true

  log "Cài các gói Docker cần thiết"
  DEBIAN_FRONTEND=noninteractive apt-get -y -qq install \
    docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
  systemctl enable --now docker
fi
docker --version
docker compose version

# ── 2. Swap ──────────────────────────────────────────────────────────────
# `next build` chạy ngay trên VPS lúc deploy. RAM hiện đủ, nhưng swap 2G là
# lưới an toàn để build không bị OOM kill giữa chừng.
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  log "Tạo swap 2G"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  log "Đã có swap, bỏ qua"
fi

# ── 3. Firewall ──────────────────────────────────────────────────────────
# CỐ Ý KHÔNG tự bật ufw. Server này đang chạy production khác (4 site nginx +
# MySQL mở ra ngoài ở 3306); bật firewall với rule chỉ 22/80/443 sẽ cắt đứt
# các dịch vụ đó. Siết firewall là việc phải làm tay, có cân nhắc.
log "Bỏ qua firewall (xem ghi chú trong script)"
ufw status 2>/dev/null | head -1 || true

# ── 4. Source code ───────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "$APP_DIR đã tồn tại, fetch bản mới nhất"
  git -C "$APP_DIR" fetch --prune origin
else
  log "Clone repo về $APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# ── 5. .env ──────────────────────────────────────────────────────────────
# KHÔNG bao giờ ghi đè .env đang có — sẽ làm đổi SESSION_SECRET (đăng xuất
# toàn bộ) và lệch mật khẩu DB với dữ liệu đã ghi trên đĩa.
if [ -f .env ]; then
  log ".env đã tồn tại — giữ nguyên"
else
  log "Sinh .env với secret ngẫu nhiên"
  DB_PASS="$(openssl rand -hex 16)"
  SESSION="$(openssl rand -hex 32)"
  rand_code() { echo "$1-$(openssl rand -hex 3 | tr 'a-f' 'A-F')"; }
  cat > .env <<EOF
POSTGRES_USER=hs
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=hackathon
DATABASE_URL="postgresql://hs:$DB_PASS@db:5432/hackathon?schema=public"
SESSION_SECRET="$SESSION"
ADMIN_ACCESS_CODE="$(rand_code ADMIN)"
HEAD_ACCESS_CODE="$(rand_code HEAD)"
JUDGE_ACCESS_CODES="$(rand_code BGK2),$(rand_code BGK3),$(rand_code BGK4),$(rand_code BGK5)"
EOF
  chmod 600 .env
fi

# ── 6. Quyền deploy cho CI ───────────────────────────────────────────────
if [ -n "$CI_PUBKEY" ]; then
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  if grep -qF "$CI_PUBKEY" ~/.ssh/authorized_keys; then
    log "Public key CI đã có trong authorized_keys"
  else
    log "Thêm public key CI vào authorized_keys"
    echo "$CI_PUBKEY" >> ~/.ssh/authorized_keys
  fi
fi

# ── 7. Khởi động ─────────────────────────────────────────────────────────
log "Build và khởi động (lần đầu mất vài phút)"
docker compose up -d --build

log "Chờ app sẵn sàng"
for i in $(seq 1 60); do
  curl -sf -o /dev/null http://127.0.0.1:3100/api/results && break || sleep 5
done

echo
log "Xong. Bước cuối: seed dữ liệu — CHỈ chạy đúng một lần"
cat <<'EOF'

  docker compose exec app npx tsx prisma/seed.ts

Lệnh trên in ra toàn bộ access code. Xem lại sau bằng:

  docker compose exec app npx tsx prisma/show-codes.ts

Sau đó dựng reverse proxy + HTTPS (bắt buộc, nếu không sẽ không đăng nhập được)
theo mục 5 trong docs/DEPLOY.md.

EOF
