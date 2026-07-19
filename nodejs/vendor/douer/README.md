# douer 引擎（本地固化）

本目录存放 CatVod/MiraPlay 完整运行时 `index.js`，构建时复制到 `dist/`，**不再依赖外网仓库**。

| 文件 | 说明 |
|------|------|
| `index.js` | 完整爬虫引擎（约 4MB） |
| `index.js.md5` | 校验值，构建时核对 |

## 更新引擎（可选）

先检测是否有更新（不下载）：

```bash
npm run vendor:check
```

确认要跟版时再拉取：

```bash
npm run vendor:refresh
```

默认来源：`Darklessing/catvod` 的 `douer/index.js`。拉取后需：

1. 适配 `scripts/copy-runtime.mjs` 补丁锚点（minify 符号常变）
2. `npm run build && node scripts/test-patched-runtime.cjs`
3. 提交本目录并部署 `dist`

**不要自动合入。** GitHub Actions `check-upstream.yml` 只开 Issue 提醒。

当前固化版本（2026-07-14）：`0c6fdbe175f9a2901f707f6ef5107c05`
