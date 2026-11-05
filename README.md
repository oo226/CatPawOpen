# CatPawOpen

基于 Node.js 的视频源爬虫 API，服务于 CatVod / CatPaw 客户端。

## 快速开始

```bash
cd nodejs
npm install
npm run dev      # 开发模式，http://localhost:3006
npm run build    # 生产构建，产物在 dist/
npm start        # 生产运行（固定 3006 端口）
```

## 接入 CatVod / MiraPlay（不用本地，手机也能用）

1. 把本项目推到 GitHub 公开仓库
2. Push 后 GitHub Actions 会构建并发布到 `dist` 分支
3. 构建时会：
   - 编译 **index.config.js**（配置页、弹幕、网盘、直播等，对齐 [Darklessing/catvod douer](https://github.com/Darklessing/catvod/tree/main/douer) 结构）
   - 从仓库内 **vendor/douer** 复制 **index.js 完整运行时**（约 5–6MB）

### 国内朋友加源（推荐 Gitee）

GitHub raw / 公共加速（ghfast 等）在国内经常全挂，**镜像不能当长期方案**。稳定做法：同步同一份 `dist` 到 Gitee。

1. 在 [gitee.com](https://gitee.com) 建公开仓库（如 `CatPawOpen`）
2. 生成私人令牌（勾选 projects）
3. GitHub 本仓库 → Settings → Secrets → Actions 添加：
   - `GITEE_TOKEN`
   - `GITEE_OWNER`（你的 Gitee 用户名）
   - `GITEE_REPO`（可选，默认 `CatPawOpen`）
4. 跑一次 Actions「Build and Deploy」后，朋友填：

```text
https://gitee.com/<你的用户名>/CatPawOpen/raw/dist/nodejs/dist/index.js.md5
```

### 临时：家里电脑局域网

```bash
cd nodejs && npm run build && python3 scripts/serve-dist.py
```

同一 WiFi 填：`http://<电脑IP>:8080/index.js.md5`

### 能直连 GitHub 时

```text
https://raw.githubusercontent.com/oo226/CatPawOpen/dist/nodejs/dist/index.js.md5
```

或：

```json
{
  "spider": "github://oo226/CatPawOpen@dist/nodejs/dist/index.config.js.md5"
}
```

完整配置示例见 [catvod-config.example.json](./catvod-config.example.json)。

## 自建 API 服务器（可选）

如果有 VPS，也可以部署成独立 HTTP 服务：

```bash
cd nodejs && npm install && npm start
```

然后通过 `http://你的服务器IP:3006/config` 获取站点列表。

## 架构说明

| 文件 | 作用 |
|------|------|
| `index.config.js` | 源配置（弹幕/网盘/直播/采集/t4 等），驱动 MiraPlay 配置页 |
| `index.js` | 完整爬虫运行时（vendor 自 douer 同级引擎） |

本地开发自有爬虫时用 `npm run build:local` + `npm run dev`。

## 预置采集（cms.list）

非凡、量子、OK、红牛、闪电、索尼、魔都、天涯、百度云等 MacCMS 采集在 `index.config.js` 的 `cms.list` 中。douer 会为每条注册一个「采」菜单项（与上游一致，不再做 cmshub 聚合）。

引擎固化自 Darklessing douer；上游更新由 Actions `sync-upstream.yml` 自动检测并拉取；本地也可 `npm run vendor:check` / `vendor:refresh`。局域网试源见 `nodejs/scripts/serve-dist.py`；JS spider 规范见 `nodejs/docs/js-spider.md`。

## 开发新爬虫

1. 在 `nodejs/src/spider/video/` 新建 `.js` 文件
2. 在 `nodejs/src/router.js` 注册
3. 在 `nodejs/src/index.config.js` 添加配置（如需要）
4. 访问 `http://localhost:3006/spider/你的key/3/test` 测试

详细教程见 `爬虫编写手册.md`。
