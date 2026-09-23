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

## 站内术语表（黑话）

| 站内叫法 | 含义 |
|---------|------|
| **岛民** | 观众 / 用户（播放量显示为「N 位岛民看过」） |
| **上新** | 投稿 / 上传视频 |
| **岛图** | 功能总览 / 站点地图（`map.html`） |
| **屿论** | 评论（每条视频下方） |
| **定点屿论** | 弹幕（钉在视频某个时间点飞出） |
| **岛名** | 显示昵称（本地设置，不覆盖小蓝页昵称） |
| **签名** | 个人简介（最长 120 字） |

## 登录：小蓝页 SSO（跨站单点登录）

片屿**不存密码**。岛民用小蓝页账户登录，头像显示在顶栏右上角。

```
片屿 /api/sso/start  --302-->  小蓝页 /api/sso/authorize
                                     │ 校验 client_id + redirect_uri 白名单
                                     │ 已登录 → 签发一次性 code（KV，120s）
                                     ▼
片屿 /api/sso/callback  <--302--  带上 code
        │ 服务端 fetch（Bearer 密钥）换身份
        ▼
小蓝页 /api/sso/token   -->  { sub, login, name, avatar_url, isAdmin }
        │
        ▼
片屿在 jerrypianyu.pages.dev 域下种自己的会话 Cookie：pianyu_uid（30 天）
```

**为什么要这么绕**：`pages.dev` 在公共后缀名单里，`jerrypianyu.pages.dev` 与小蓝页属于
**不同站点**，Cookie 无法跨子域共享。所以只能「服务端换码 + 各自种自己的会话」，
只有身份（`sub` = 小蓝页账户 ID）是同一个。

**密钥隔离**：小蓝页换码端点按客户端取密钥 ——
`SSO_SECRET_<CLIENT_ID大写>` 优先，缺省回退 `SSO_CLIENT_SECRET`。
所以片屿有自己的 `SSO_SECRET_PIANYU`，**不需要轮换茶馆等既有站点的密钥**。

| 位置 | 变量 | 说明 |
|------|------|------|
| 小蓝页 `mc-creator-jerry-webpage` | `SSO_SECRET_PIANYU` | 片屿专用，与下面同值 |
| 片屿 `jerrypianyu` | `SSO_CLIENT_SECRET` | 与上面同值 |

> ⚠️ Pages 的密钥/变量**只在重新部署后生效**。改了密钥务必再跑一次部署。

## 深浅模式

- 顶栏右上角 ☀️/🌙 按钮一键切换；设置页可选「浅色 / 深色 / 跟随系统」。
- 实现：`html[data-theme="light"]` 覆盖一组 CSS 变量；选择存 `localStorage['pianyu-theme']`。
- 页面 `<head>` 内联一小段脚本**先于 CSS** 应用主题，避免首屏闪色。

## 目录结构

```
pianyu-site/
  index.html          首页（片滩：视频网格 + 搜索 + 标签筛选）
  watch.html          观看页（?id=；含「屿论」评论区 + 「定点屿论」弹幕层）
  admin.html          上新（登录 + 增/改/删）
  map.html            岛图（站点功能地图）
  profile.html        我的主页（岛民档案 + 足迹：屿论 / 定点屿论）
  settings.html       设置（岛名 / 签名 / 显示模式 / 退出登录）
  404.html
  assets/pianyu.css   样式（深色岛屿主题 + 浅色变量 + 头像/菜单组件）
  assets/pianyu.js    共享脚本（API / 卡片 / PY.theme / PY.user / PY.mountHeader）
  assets/favicon.svg
  functions/          独立后端
    _lib/store.js       KV 读写 + 管理员会话 + 屿论/定点屿论
    _lib/auth.js        管理员鉴权（Cookie: pianyu_sid）
    _lib/pyauth.js      岛民会话 + SSO state + 个人设置（Cookie: pianyu_uid）
    api/videos.js       GET 列表/POST 新建
    api/videos/[id].js  GET 详情/PATCH 改/DELETE 删
    api/comments.js     GET/POST 屿论（登录者自动归属）
    api/danmaku.js      GET/POST 定点屿论（登录者自动归属）
    api/me.js           GET 当前岛民
    api/logout.js       POST 岛民登出
    api/profile.js      GET 我的档案 + 足迹
    api/settings.js     GET/POST 岛名与签名
    api/sso/start.js    GET  SSO 起点（生成 state → 302 小蓝页）
    api/sso/callback.js GET  SSO 回调（换身份 → 种 pianyu_uid）
    api/admin/login.js  POST 管理员登录
    api/admin/logout.js POST 管理员退出
    api/admin/me.js     GET 管理员登录态
  wrangler.toml      本目录专属（隔离关键）
  .assetsignore      防止 functions/ 等被当静态资源上传
```

> 两套会话刻意分开：**管理员**走 `pianyu_sid`（密码），**岛民**走 `pianyu_uid`（小蓝页 SSO）。

## API

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/videos?q=&tag=` | 公开 | 列表（支持搜索/标签过滤） |
| POST | `/api/videos` | 管理员 | 新建视频 |
| GET | `/api/videos/:id` | 公开 | 详情（顺带 +1 播放量） |
| PATCH | `/api/videos/:id` | 管理员 | 修改 |
| DELETE | `/api/videos/:id` | 管理员 | 删除 |
| GET | `/api/comments?videoId=` | 公开 | 屿论列表 |
| POST | `/api/comments` | 公开 | 发表屿论 `{videoId,name?,text}`（登录时以会话身份为准） |
| GET | `/api/danmaku?videoId=` | 公开 | 定点屿论列表 |
| POST | `/api/danmaku` | 公开 | 发送定点屿论 `{videoId,time,text,color?}` |
| GET | `/api/me` | 公开 | 当前岛民 `{ok,user}`（未登录 `user=null`） |
| POST | `/api/logout` | 岛民 | 登出（清 `pianyu_uid`） |
| GET | `/api/profile` | 岛民 | 我的档案 + 足迹 `{user,activity,stats}` |
| GET | `/api/settings` | 岛民 | 读设置 |
| POST | `/api/settings` | 岛民 | 存设置 `{display_name?,bio?}` |
| GET | `/api/sso/start?next=` | 公开 | 302 到小蓝页授权端点 |
| GET | `/api/sso/callback` | 公开 | SSO 回调（code → 会话） |
| POST | `/api/admin/login` | — | 管理员登录（body `{password}`） |
| POST | `/api/admin/logout` | — | 管理员退出 |
| GET | `/api/admin/me` | — | 管理员登录态 `{loggedIn}` |

## 部署

### 1) Cloudflare Pages

```powershell
# 密钥（仅需一次，不入库；改了必须重新部署才生效）
wrangler pages secret put PIANYU_ADMIN_PASSWORD --project-name jerrypianyu
wrangler pages secret put SSO_CLIENT_SECRET     --project-name jerrypianyu

# 部署（务必先 cd 进站点目录，脚本已处理）
powershell -ExecutionPolicy Bypass -File "C:\Users\jerry\WorkBuddy\automation-2026-08-16-12-12-06\deploy-pianyu.ps1"
```

小蓝页侧（身份提供方）改动后也要重新部署一次：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\jerry\WorkBuddy\automation-2026-08-16-12-12-06\deploy-cf.ps1"
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
| SSO 客户端密钥 | `SSO_CLIENT_SECRET`（Pages secret，＝小蓝页的 `SSO_SECRET_PIANYU`） |
| 管理员 Cookie | `pianyu_sid` |
| 岛民 Cookie | `pianyu_uid` |
| GitHub 仓库 | `MC-Creator-Jerry/Pianyu` |
