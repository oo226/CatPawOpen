# douer 引擎（本地固化）

本目录存放 CatVod/MiraPlay 完整运行时 `index.js`，构建时复制到 `dist/`。

**手机加载的是本仓库 `dist` 分支，不依赖上游在线。** 上游（`Darklessing/catvod`）只用于可选自动更新这份快照。

| 文件 | 说明 |
|------|------|
| `index.js` | 完整爬虫引擎（约 5–6MB） |
| `index.js.md5` | 校验值，构建时核对 |

## 若上游删库 / 拉不到

- 已提交进 Git 的 `vendor/douer/` 仍可用；`npm run build` / `deploy` 照常。
- 每日 `sync-upstream` 会报「unreachable」并跳过更新，**不会清空或破坏**本地快照。
- 只有上游恢复后才会再次自动升级。

## 更新引擎（可选）

```bash
npm run vendor:check      # 对比 md5；上游不可达时退出 0 并保留本地
npm run vendor:refresh    # 下载并原子写入；失败不覆盖
npm run build             # 从 vendor 复制到 dist
```

默认来源：`Darklessing/catvod` 的 `douer/index.js`（含 ghfast / ghproxy 镜像）。

当前固化版本：`186bc2f7a8d082c97c6779daf15557bc`
