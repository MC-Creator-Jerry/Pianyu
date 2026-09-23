# 片屿 · PIANYU

一座收藏与分享视频的小岛 —— **独立站点 + 独立后端**，部署在 Cloudflare Pages。

- 线上地址：https://jerrypianyu.pages.dev/
- 独立后端：本目录内 `functions/`（Cloudflare Pages Functions），**不与其他站点共享**
- 独立存储：Cloudflare KV `PIANYU_KV`
- GitHub 镜像：https://github.com/MC-Creator-Jerry/Pianyu

## 存储模式：外链（零成本）

为满足「坚决不付费」：**本站不托管视频文件**，只保存视频的**外链地址 + 元数据**。
- 直链模式（`source=file`）：填 mp4/webm 等直链，播放页用原生 `<video>` 播放。
- 嵌入模式（`source=embed`）：填 B 站/YouTube 等嵌入页地址，播放页用 `<iframe>` 播放。

因此无需 R2、无需绑卡，Cloudflare 免费额度内 100% 零成本。
（若日后启用 R2 免费额度，可加一个开关切到「自托管上传」，架构已预留。）

## 目录结构

```
pianyu-site/
  index.html          首页（视频网格 + 搜索 + 标签筛选）
  watch.html          播放页（?id=）
  admin.html          管理台（登录 + 增/改/删）
  404.html
  assets/pianyu.css   样式（暗色岛屿主题）
  assets/pianyu.js    共享脚本
  assets/favicon.svg
  functions/          独立后端
    _lib/store.js       KV 读写 + 会话
    _lib/auth.js        管理员鉴权（Cookie: pianyu_sid）
    api/videos.js       GET 列表/POST 新建
    api/videos/[id].js  GET 详情/PATCH 改/DELETE 删
    api/admin/login.js  POST 登录
    api/admin/logout.js POST 退出
    api/admin/me.js     GET 登录态
  wrangler.toml      本目录专属（隔离关键）
  .assetsignore      防止 functions/ 等被当静态资源上传
```

## API

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/videos?q=&tag=` | 公开 | 列表（支持搜索/标签过滤） |
| POST | `/api/videos` | 管理员 | 新建视频 |
| GET | `/api/videos/:id` | 公开 | 详情（顺带 +1 播放量） |
| PATCH | `/api/videos/:id` | 管理员 | 修改 |
| DELETE | `/api/videos/:id` | 管理员 | 删除 |
| POST | `/api/admin/login` | — | 登录（body `{password}`） |
| POST | `/api/admin/logout` | — | 退出 |
| GET | `/api/admin/me` | — | 登录态 `{loggedIn}` |

## 部署

### 1) Cloudflare Pages

```powershell
# 设置管理员密码（仅需一次，不入库）
wrangler pages secret put PIANYU_ADMIN_PASSWORD --project-name jerrypianyu

# 部署（务必先 cd 进站点目录，脚本已处理）
powershell -ExecutionPolicy Bypass -File "C:\Users\jerry\WorkBuddy\automation-2026-08-16-12-12-06\deploy-pianyu.ps1"
```

### 2) GitHub 镜像

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\jerry\WorkBuddy\automation-2026-08-16-12-12-06\deploy-pianyu-gh.ps1"
```

> ⚠️ 隔离红线：`deploy-pianyu.ps1` 会 `Set-Location` 到 `pianyu-site/` 再 deploy。
> 切勿在工作区根目录直接跑 `wrangler pages deploy`——那会读到 xiaolan 的 `wrangler.toml`
> 并上传 xiaolan 的 Functions（串站事故）。

## 独立资源清单（勿与他站混用）

| 资源 | 值 |
|------|----|
| Pages 项目 | `jerrypianyu`（线上域 `jerrypianyu.pages.dev`） |
| KV 命名空间 | `PIANYU_KV` = `167dfe1ed81d4471bb630f2bc7b01247` |
| 管理员密钥 | `PIANYU_ADMIN_PASSWORD`（Pages secret） |
| 会话 Cookie | `pianyu_sid` |
| GitHub 仓库 | `MC-Creator-Jerry/Pianyu` |
