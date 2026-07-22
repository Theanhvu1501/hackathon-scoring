# Deploy lên VPS

Stack: Next.js (standalone) + Postgres 16, chạy bằng Docker Compose, nginx đứng
trước lo TLS. Domain: **fa-hackathon-judges.com**

> **Quy tắc quan trọng nhất:** `prisma/seed.ts` XOÁ SẠCH dữ liệu trước khi tạo lại
> data mẫu. Nó chỉ được chạy tay đúng một lần lúc khởi tạo, không bao giờ nằm
> trong lệnh start của container.

---

## 0. Server dùng chung — đọc trước khi làm gì

VPS (Ubuntu 20.04, 4 CPU, 5.8GB RAM) **không trống**: nó đang chạy sẵn nhiều site
production khác, quản lý bằng pm2 + nginx, cùng một database server riêng. Địa chỉ
và danh sách cụ thể xem trong `~/.ssh/config` (host `hackathon`) và trực tiếp trên
máy — cố ý không ghi ở đây vì repo này công khai.

Hệ quả bắt buộc tuân thủ:

- **App này dùng port 3100.** Các port 3000, 3001, 4000, 4001, 5000, 5001 đã bị
  app khác chiếm. Kiểm tra trước khi đổi: `ss -tlnp | grep LISTEN`
- **Không cài Caddy/Apache** — nginx đang giữ port 80 cho toàn bộ vhost sẵn có.
  Cài web server thứ hai sẽ tranh port và làm sập tất cả.
- **Không tự bật `ufw`** — firewall đang tắt có chủ đích; bật với rule chỉ
  22/80/443 sẽ cắt các dịch vụ khác đang chạy. Muốn siết thì làm tay, có cân nhắc.
- **`nginx -t` fail thì tuyệt đối không reload** — reload lỗi ảnh hưởng mọi site
  trên máy, không riêng site này.

### Dọn đĩa trước

Đĩa 45G đã dùng 77%, chỉ còn ~9.7GB, trong khi build Docker cần 5–6GB. Thủ phạm
là log pm2 **13GB** và vẫn đang phình:

```bash
du -sh /root/.pm2/logs     # ~13G
pm2 flush                  # giải phóng, đĩa về ~48%
```

Nên cài luôn xoay vòng log để khỏi lặp lại (log đầy đĩa sẽ kéo sập cả 7 site):

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

`vps-bootstrap.sh` sẽ tự dừng nếu đĩa trống dưới 8GB hoặc port 3100 bị chiếm.

## 1. Chuẩn bị VPS (một lần duy nhất)

Có script làm hết: cài Docker, tạo swap, clone repo, sinh `.env` với secret ngẫu
nhiên, rồi build và chạy. Script **không** đụng vào firewall hay nginx.

```bash
ssh hackathon
curl -fsSL https://raw.githubusercontent.com/Theanhvu1501/hackathon-scoring/master/scripts/vps-bootstrap.sh | bash
```

Script idempotent — chạy lại nhiều lần vô hại, và **không bao giờ ghi đè `.env`
đang có**.

> Đừng cài Docker bằng `apt install docker.io` trên Ubuntu 20.04: bản trong repo
> mặc định quá cũ, thiếu plugin `docker compose` (v2) mà compose file này cần.
> Script dùng repo chính thức của Docker.

Muốn làm tay thì xem nội dung `scripts/vps-bootstrap.sh` — mỗi bước đều có ghi chú.

## 2. Kiểm tra `.env`

Script tự sinh `/opt/hackathon-scoring/.env` với mật khẩu DB, `SESSION_SECRET`
và các mã truy cập đều ngẫu nhiên. Xem lại bằng `cat /opt/hackathon-scoring/.env`.

Nếu tự viết tay (`cp .env.example .env`), ba chỗ hay sai:

- `POSTGRES_PASSWORD` phải trùng với mật khẩu trong `DATABASE_URL`.
- Host trong `DATABASE_URL` là `db` (tên service), **không phải** `localhost`.
- Đổi hết mã truy cập. Mã mặc định (`ADMIN-2026`, `HEAD-2026`, `BGK2-2026`…)
  nằm công khai trong repo — để nguyên thì ai đọc repo cũng vào được trang BGK.

## 3. Build và chạy

Bootstrap đã làm rồi. Chạy tay thì:

```bash
cd /opt/hackathon-scoring
docker compose up -d --build
docker compose logs -f app     # chờ tới dòng "Ready in ..."
```

Lúc start container tự chạy `prisma migrate deploy` (an toàn, chỉ apply migration
còn thiếu). Database lúc này vẫn trống rỗng.

## 4. Seed — chạy đúng MỘT lần

```bash
docker compose exec app npx tsx prisma/seed.ts
```

Lệnh này in ra toàn bộ access code — lưu lại ngay. Cần xem lại sau:

```bash
docker compose exec app npx tsx prisma/show-codes.ts
```

Nếu database đã có dữ liệu, seed sẽ **tự dừng** và không xoá gì. Muốn reset thật
(sau khi đã backup) thì mới thêm `SEED_FORCE=1`:

```bash
docker compose exec -e SEED_FORCE=1 app npx tsx prisma/seed.ts
```

Với `NODE_ENV=production`, seed tạo team/BGK/tiêu chí nhưng **không** tạo điểm mẫu.
Muốn có điểm mẫu để demo: thêm `-e SEED_SCORES=1`.

## 5. Reverse proxy + HTTPS (bắt buộc)

Cookie phiên đăng nhập được set `secure: true` khi `NODE_ENV=production`
(`src/app/api/auth/login/route.ts`). Chạy HTTP thuần thì trình duyệt vứt cookie
→ **đăng nhập xong bị đá về trang login vô hạn**. Phải có TLS thật.

> **KHÔNG cài Caddy hay Apache.** VPS này đã có nginx đang phục vụ 7 vhost thật
> của các dự án khác.
> Cài web server thứ hai sẽ tranh port 80 và làm sập toàn bộ. Ta thêm vhost vào
> nginx sẵn có.

File vhost đã viết sẵn tại `deploy/nginx/fa-hackathon-judges.com.conf`.

```bash
cd /opt/hackathon-scoring
cp deploy/nginx/fa-hackathon-judges.com.conf \
   /etc/nginx/sites-available/fa-hackathon-judges.com
ln -s /etc/nginx/sites-available/fa-hackathon-judges.com /etc/nginx/sites-enabled/

nginx -t              # BẮT BUỘC kiểm tra trước khi reload
systemctl reload nginx
```

`nginx -t` fail thì **đừng reload** — sửa cho sạch đã, vì reload lỗi ảnh hưởng cả
7 site đang chạy chứ không riêng site này.

Cấp chứng chỉ (DNS của `fa-hackathon-judges.com` đã trỏ sẵn về VPS):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d fa-hackathon-judges.com -d www.fa-hackathon-judges.com
```

certbot tự thêm block `listen 443 ssl`, đường dẫn chứng chỉ và redirect 80 → 443
vào file vhost, đồng thời cài cron tự gia hạn. Đây sẽ là site **đầu tiên** trên
server có HTTPS — các site còn lại vẫn đang HTTP thuần.

Hai điểm trong vhost không được bỏ:

- `client_max_body_size 10m` — ảnh logo/thành viên lưu base64 trong DB, body POST
  vài trăm KB; mặc định 1m sẽ trả 413 khi admin upload ảnh.
- Block `location /api/stream` với `proxy_buffering off` — thiếu là bảng điểm trên
  màn hình lớn đứng im, không tự cập nhật.

## 6. Dữ liệu & backup

Postgres ghi thẳng vào `./data/postgres` trên host (bind mount trong
`docker-compose.yml`). Thư mục này nằm ngoài image nên sống sót qua
`docker compose down`, rebuild, đổi image — chỉ mất khi bạn tự xoá tay.

Backup (chạy trước và trong ngày chấm):

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U hs hackathon > backups/hackathon-$(date +%F-%H%M).sql
```

Restore:

```bash
docker compose exec -T db psql -U hs -d hackathon < backups/hackathon-2026-07-22-1400.sql
```

## 7. CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml` — **hiện đang tắt trigger tự động**, chỉ chạy khi
bấm tay ở tab Actions. Dự án đang deploy thủ công (mục 8). Muốn bật lại thì bỏ
comment phần `push`/`pull_request` trong file, **sau khi** đã khai báo đủ secrets
bên dưới — thiếu secrets thì job deploy fail ngay ở bước SSH.

Khi bật: mọi push và PR vào `master` chạy job `test` (dựng Postgres thật →
`prisma migrate deploy` → `tsc --noEmit` → `npm test` → `npm run build`). Chỉ khi
job này xanh **và** đang ở nhánh `master` thì job `deploy` mới chạy: SSH vào VPS,
`git reset --hard` về đúng commit, rồi `docker compose up -d --build`.

Sau khi build, workflow poll `/api/results` tối đa 5 phút. Không lên được thì nó
in log container, **tự rollback về commit trước** và fail. Cuối cùng dọn image cũ
vì đĩa VPS chỉ còn khoảng 10GB.

`concurrency: deploy-production` đảm bảo không có 2 lần deploy chồng nhau, và
`cancel-in-progress: false` để không cắt ngang lúc container đang migrate.

### Tạo khoá deploy riêng cho CI

Đừng dùng khoá SSH cá nhân. Sinh một cặp khoá chỉ dành cho CI (chạy ở máy local):

```bash
ssh-keygen -t ed25519 -N '' -C 'hackathon-ci' -f ~/.ssh/hackathon_ci
```

Nạp public key lên VPS (bootstrap nhận nó làm tham số):

```bash
ssh hackathon "bash -s" -- < scripts/vps-bootstrap.sh "$(cat ~/.ssh/hackathon_ci.pub)"
```

hoặc thủ công: `ssh-copy-id -i ~/.ssh/hackathon_ci.pub hackathon`

### Khai báo secrets trên GitHub

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Giá trị |
|---|---|
| `SSH_HOST` | IP của VPS |
| `SSH_USER` | `root` |
| `SSH_PORT` | `22` |
| `SSH_PRIVATE_KEY` | toàn bộ nội dung `~/.ssh/hackathon_ci` (kể cả dòng `BEGIN`/`END`) |
| `SSH_KNOWN_HOSTS` | kết quả của `ssh-keyscan -p 22 <IP>` |

`SSH_KNOWN_HOSTS` là bắt buộc: workflow bật `StrictHostKeyChecking=yes` nên nếu
thiếu sẽ không kết nối được. Đây là chủ ý — tắt nó đi thì deploy dễ bị
man-in-the-middle.

Tuỳ chọn: biến `APP_DIR` (tab *Variables*) nếu code không nằm ở
`/opt/hackathon-scoring`.

```bash
ssh-keyscan -p 22 <IP-VPS>            # copy toàn bộ output vào SSH_KNOWN_HOSTS
cat ~/.ssh/hackathon_ci               # copy toàn bộ vào SSH_PRIVATE_KEY
```

Khi đã bật trigger: merge vào `master` là tự động deploy. Chạy tay bất cứ lúc nào
ở tab **Actions → CI/CD → Run workflow**.

Pipeline **không bao giờ chạy seed** — chỉ `migrate deploy`. Dữ liệu chấm điểm
an toàn qua mọi lần deploy.

## 8. Deploy thủ công (cách đang dùng)

Đồng bộ code từ máy local lên rồi build lại trên VPS:

```bash
# từ thư mục dự án ở máy local
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude data --exclude .env \
  --exclude tsconfig.tsbuildinfo --exclude '*.log' \
  ./ hackathon:/opt/hackathon-scoring/

ssh hackathon 'cd /opt/hackathon-scoring && docker compose up -d --build'
```

`--exclude data` và `--exclude .env` là bắt buộc: thiếu chúng, `--delete` sẽ xoá
database và file secret trên server.

Code được nướng vào image lúc build, container không mount source — nên sửa file
trên VPS rồi restart sẽ **không có tác dụng**, luôn phải `--build`.

Kiểm tra sau khi deploy:

```bash
ssh hackathon 'cd /opt/hackathon-scoring
  curl -sf -o /dev/null http://127.0.0.1:3100/api/results && echo "app UP"
  docker compose exec -T db psql -U hs -d hackathon -tAc "select count(*) from \"Score\""'
```

## Những chỗ dễ vấp

| Triệu chứng | Nguyên nhân |
|---|---|
| Đăng nhập xong quay lại trang login | Đang chạy HTTP, cookie `secure` bị vứt. Phải có HTTPS. |
| Bảng điểm không tự cập nhật | Nginx buffer SSE — thiếu `proxy_buffering off`. |
| Upload ảnh lỗi 413 | Thiếu `client_max_body_size 10m`. |
| Mất hết điểm sau restart | Seed bị chạy lại. Kiểm tra `command` trong docker-compose.yml. |
| Build bị kill | Hết RAM khi `next build` — tạo swap. |
| `port is already allocated` | Port 3100 bị chiếm — `ss -tlnp \| grep 3100`. |
| Build fail `no space left` | Đĩa đầy — `pm2 flush`, `docker system prune -af`. |
| `nginx -t` fail sau khi thêm vhost | **Đừng reload** — reload lỗi ảnh hưởng cả 7 site. Sửa xong mới reload. |

**Không scale quá 1 replica app.** Event bus realtime là `EventEmitter` in-process
(`src/lib/events.ts`); chạy 2 instance thì client nối vào instance A sẽ không nhận
được event phát từ instance B.
