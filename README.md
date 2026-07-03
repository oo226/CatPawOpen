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

## 接入 CatVod（不用本地，手机/TV 也能用）

1. 把本项目推到 GitHub 公开仓库
2. Push 到 `main` 后，GitHub Actions 会自动构建并发布到 `dist` 分支
3. 在 CatVod 自定义配置里填入（把用户名改成你的）：

```json
{
  "spider": "github://你的用户名/CatPawOpen@dist/nodejs/dist/index.config.js.md5"
}
```

完整配置示例见 [catvod-config.example.json](./catvod-config.example.json)。

App 会从 GitHub 拉取构建产物，在设备内置 Node 运行时里执行，**不需要你的电脑开着**。

## 自建 API 服务器（可选）

如果有 VPS，也可以部署成独立 HTTP 服务：

```bash
cd nodejs && npm install && npm start
```

然后通过 `http://你的服务器IP:3006/config` 获取站点列表。

## 已内置爬虫

| 名称 | key | 状态 |
|------|-----|------|
| 我的影视 | myvideo | 可用（示例模板） |
| 非凡采集 | ffm3u8 | 可用 |
| 推送 | push | 可用 |
| 酷云七七 | kunyu77 | 源站异常 |
| 快看影视 | kkys | 源站异常 |

## 开发新爬虫

1. 在 `nodejs/src/spider/video/` 新建 `.js` 文件
2. 在 `nodejs/src/router.js` 注册
3. 在 `nodejs/src/index.config.js` 添加配置（如需要）
4. 访问 `http://localhost:3006/spider/你的key/3/test` 测试

详细教程见 `爬虫编写手册.md`。
