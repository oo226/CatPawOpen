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
   - 从仓库内 **vendor/douer** 复制 **index.js 完整运行时**（约 4MB，与 douer 同档，构建不访问外网）
4. 在 MiraPlay 填入：

```json
{
  "spider": "github://你的用户名/CatPawOpen@dist/nodejs/dist/index.config.js.md5"
}
```

与 douer 一样，只需填 `spider` 一行，站点由源包自动生成。

完整配置示例见 [catvod-config.example.json](./catvod-config.example.json)。

App 会从 GitHub 拉取构建产物，在设备内置 Node 运行时里执行，**不需要你的电脑开着**。

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

非凡、量子、OK、红牛、闪电、索尼、魔都、天涯、百度云等 MacCMS 采集在 `index.config.js` 的 `cms.list` 中。

菜单只显示一个 **「采」采集** 入口（与 douer 一致）：`cmshub` 聚合搜索，结果按资源站名称分组为二级；配置里 `sites.list` 将各子源设为 `enable: false` 避免平铺。

## 开发新爬虫

1. 在 `nodejs/src/spider/video/` 新建 `.js` 文件
2. 在 `nodejs/src/router.js` 注册
3. 在 `nodejs/src/index.config.js` 添加配置（如需要）
4. 访问 `http://localhost:3006/spider/你的key/3/test` 测试

详细教程见 `爬虫编写手册.md`。
