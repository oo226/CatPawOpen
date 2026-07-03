# douer 引擎（本地固化）

本目录存放 CatVod/MiraPlay 完整运行时 `index.js`，构建时复制到 `dist/`，**不再依赖外网仓库**。

| 文件 | 说明 |
|------|------|
| `index.js` | 完整爬虫引擎（约 4MB） |
| `index.js.md5` | 校验值，构建时核对 |

## 更新引擎（可选）

若需从上游重新拉取最新版：

```bash
npm run vendor:refresh
```

默认来源：`Darklessing/catvod` 的 `douer/index.js`。拉取后会更新本目录并需提交 Git。
