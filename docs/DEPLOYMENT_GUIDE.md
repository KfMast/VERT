# VERT 打包与上线部署指南

## 1. 项目结构与技术架构

### 1.1 项目类型

- 前端单页应用（SvelteKit + TypeScript）
- 构建输出为纯静态资源，可部署到任意静态托管平台
- 依赖 WebAssembly 与 Web Worker（FFmpeg/ImageMagick/Pandoc）

### 1.2 关键配置与目录

- 构建入口与脚本：`package.json`
- 构建工具：Vite 5 + SvelteKit 2（`vite.config.ts`、`svelte.config.js`）
- 静态资源：`static/`（构建时复制到产物）
- 构建产物目录：`build/`（SvelteKit adapter-static 输出）
- 容器化与 Nginx 配置：`Dockerfile`、`nginx/default.conf`、`nginx/default-ssl.conf`

### 1.3 依赖管理方式

- 项目包含 `bun.lock`，Docker 构建使用 Bun
- 本地开发可使用 npm / pnpm / yarn / bun

## 2. 构建流程设计

### 2.1 生产构建命令

构建脚本定义在 `package.json`：

```bash
npm run build
```

等价流程：

- 生成国际化资源：`paraglide-js compile`
- 执行 Vite 构建：`vite build`

如果使用 Bun：

```bash
bun install
bun run build
```

### 2.2 环境变量与参数

项目通过 `PUB_` 前缀暴露构建期环境变量（SvelteKit public env）。示例可参考 `.env.example`：

- `PUB_ENV`：运行环境标识（production/development/nightly）
- `PUB_HOSTNAME`：站点主机名，用于统计等功能
- `PUB_PLAUSIBLE_URL`：Plausible 统计地址（可为空）
- `PUB_VERTD_URL`：视频转换服务地址
- `PUB_DISABLE_ALL_EXTERNAL_REQUESTS`：是否禁用外部请求
- `PUB_DISABLE_FAILURE_BLOCKS`：是否禁用视频失败限制
- `PUB_DONATION_URL`、`PUB_STRIPE_KEY`：捐赠相关配置

可选环境变量：

- `SOURCE_COMMIT`：构建时注入的提交哈希；在无 Git 环境（如部分 CI/CD）中避免 `git rev-parse` 失败

生产构建建议使用 `.env.production` 或在 CI/CD 中注入变量。

### 2.3 代码压缩与优化

- Vite 默认启用生产压缩与摇树优化
- 构建目标为 `esnext`（`vite.config.ts` 中设置）
- 依赖分割由 Vite 自动完成

### 2.4 静态资源路径与路由

- `static/` 内文件会被复制到 `build/` 根路径
- Nginx/静态托管需配置 SPA 回退至 `/index.html`
- 若需部署到子路径，需要修改 `svelte.config.js` 中的 `kit.paths.base`

## 3. 部署方案

### 3.1 静态托管（推荐）

适用平台：Vercel、Netlify、Cloudflare Pages、GitHub Pages、自建 Nginx 等

流程：

1. 安装依赖
2. 构建产物至 `build/`
3. 将 `build/` 上传到静态托管平台

静态托管需要的关键配置：

- SPA 回退：所有路由回退到 `/index.html`
- WASM MIME：确保 `.wasm` 类型为 `application/wasm`
- 缓存策略：对 `build/_app/` 及哈希文件启用长期缓存

### 3.2 自建服务器（Nginx）

可直接使用项目内 Nginx 配置文件：`nginx/default.conf`

示例部署流程：

```bash
npm install
npm run build
```

将 `build/` 内容拷贝至服务器：

```bash
rsync -avz build/ user@server:/usr/share/nginx/html/
```

启用配置并重载 Nginx。需要 SSL 时可参考 `nginx/default-ssl.conf`。

### 3.3 Docker 部署

项目提供 Dockerfile 与 docker-compose：

```bash
docker build -t vert-sh/vert \
  --build-arg PUB_ENV=production \
  --build-arg PUB_HOSTNAME=example.com \
  --build-arg PUB_PLAUSIBLE_URL= \
  --build-arg PUB_VERTD_URL=https://vertd.vert.sh \
  --build-arg PUB_DONATION_URL=https://donations.vert.sh \
  --build-arg PUB_DISABLE_ALL_EXTERNAL_REQUESTS=false \
  --build-arg PUB_STRIPE_KEY=YOUR_STRIPE_KEY .

docker run -d --restart unless-stopped -p 3000:80 --name vert vert-sh/vert
```

或使用 Compose：

```bash
docker compose up -d --build
```

### 3.4 CI/CD 建议

项目已包含 GitHub Actions 的 Docker 构建流程（`.github/workflows/docker.yml`），适用于自动构建并发布镜像。

如需静态托管发布，可新增 CI 步骤：

```yaml
- name: Install
  run: npm install
- name: Build
  run: npm run build
- name: Deploy
  run: rsync -avz build/ user@server:/usr/share/nginx/html/
```

## 4. 环境要求与构建步骤

### 4.1 环境要求

- Node.js 18+（或 Bun 最新版）
- Git（用于获取提交哈希，或使用 `SOURCE_COMMIT` 替代）

### 4.2 构建步骤

```bash
npm install
npm run build
```

本地预览：

```bash
npm run preview
```

### 4.3 构建产物验证

- 打开预览地址确认页面加载与路由切换正常
- 上传任意文件进行转换，检查 WASM 与 Worker 是否可用
- 若启用外部服务（vertd、Plausible、Stripe），确认对应请求成功

## 5. 常见问题与解决方案

1. **构建失败：无法获取 Git 提交哈希**
   - 方案：设置 `SOURCE_COMMIT` 环境变量，或在构建环境中提供 `.git`

2. **WASM 加载失败或 MIME 类型错误**
   - 方案：配置服务器对 `.wasm` 返回 `application/wasm`

3. **视频转换不可用**
   - 检查 `PUB_VERTD_URL` 是否可访问
   - 在非 HTTPS 环境下可考虑设置 `PUB_DISABLE_FAILURE_BLOCKS=true`

4. **禁用外部请求后功能不可用**
   - `PUB_DISABLE_ALL_EXTERNAL_REQUESTS=true` 会禁用 vertd、统计与捐赠相关功能

5. **静态托管路由 404**
   - 需要启用 SPA 回退到 `/index.html`

## 6. 上线核对清单

- 构建环境变量已确认并固化
- `build/` 产物可在本地 `npm run preview` 正常访问
- 静态托管已配置 SPA 回退与正确的 MIME
- 线上站点可正常加载 WASM、执行转换与下载
