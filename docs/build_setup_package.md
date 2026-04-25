# AFFiNE Windows 编译打包避坑记录

> 这是一份面向后续维护者的实战记录，重点总结最近一次在 Windows 上重新编译、打包并排查安装包问题时踩过的坑。  
> 它不是对 [`docs/building-desktop-client-app.md`](./building-desktop-client-app.md) 的重复说明，而是一个更偏“排雷手册”的补充。

## 适用范围

- 仓库根目录下的 Windows 本地打包
- Electron 桌面端安装包
- 最近一次遇到的 i18n 中文、原生依赖、`web-static` 过期问题

## 最短命令清单

如果你只想照着跑一遍，先记这 5 条就够了：

```powershell
yarn install
node packages/frontend/apps/electron/scripts/generate-assets.ts
cmd /c .\node_modules\.bin\electron-forge.cmd package
node packages/frontend/apps/electron/scripts/make-nsis.ts
& "$env:LOCALAPPDATA\Programs\AFFiNE-canary\AFFiNE-canary.exe"
```

一般情况下：

- 第 1 条只在第一次或依赖变动后执行
- 第 2 条只在改了前端资源、i18n 文案、Electron 入口时执行
- 第 3、4 条是正式打包流程
- 第 5 条是安装完成后的最小冒烟检查

## 这次打包最容易踩的坑

### 1. PowerShell 会拦住 `yarn.ps1`

在这台 Windows 环境里，直接跑 `yarn ...` 可能会触发执行策略限制：

```text
running scripts is disabled on this system
```

处理方式：

- 临时使用 `cmd /c yarn ...`
- 或者直接调用脚本和二进制，不依赖 `yarn.ps1`

这也是为什么 Electron 打包相关命令更推荐直接走 `node` / `cmd` 入口。

### 2. Electron 子包不要依赖根 workspace 的默认解析

`packages/frontend/apps/electron` 不是一个普通的顶层 workspace 命令入口。  
如果你用 `yarn --cwd ...` 或者让 Yarn 自己解析 package 边界，容易遇到类似：

```text
The nearest package directory ... doesn't seem to be part of the project
```

更稳的做法是：

- 在 Electron 子包目录里直接运行它自己的脚本
- 或者从仓库根目录显式调用 `node_modules/.bin/electron-forge.cmd`

### 3. 改了 `packages/frontend/i18n/src/resources/*.json` 之后，一定要重新生成 `web-static`

这是这次问题的核心之一。

源文件变了，不代表最终安装包里的 `web-static` 也会自动更新。  
如果没有重新生成，安装后仍然可能看到旧文案，或者旧的 `i18n-langs.zh-Hans.*.js` / `i18n-langs.zh-Hant.*.js`。

你可以用这条思路排查：

1. 先确认源 JSON 已经改对
2. 再看 `packages/frontend/apps/electron/resources/web-static/js/` 下的新 chunk
3. 最后再确认安装器和安装目录里的 `app.asar`

### 4. 中文不要在 PowerShell 内联脚本里“现写现跑”

我们这次曾经遇到过一个很典型的坑：  
在 PowerShell 里直接写内联 Node 代码，中文字符串有机会被终端编码弄成 `????`，然后又被写回了 JSON，导致源文件和打包产物都坏掉。

建议：

- 复杂的修复逻辑写成独立 `.js` / `.ts` 文件
- 如果一定要用内联脚本，尽量只做最小逻辑
- 如果你要验证中文值，优先用 Unicode 码位比较，而不是只看终端输出

### 5. 安装包能装上，不代表运行时依赖一定没问题

我们实际踩过两类启动错误：

- `Cannot find module 'electron-updater'`
- `Cannot find native binding`

这两类问题通常不是安装器本身坏了，而是打包时运行时依赖没被正确带进去。

排查时重点看：

- `electron-updater` 这类运行时依赖是否还放在 `dependencies`
- `@affine/native` 是否被正确视为运行时依赖
- 原生 `.node` 文件是否被正确编译、拷贝和 unpack
- `main.js` / `helper.js` 是否把原生模块错误地打包进去了

### 6. 安装后看到旧界面，先判断是“资源没更新”还是“安装没覆盖”

推荐按这个顺序看：

1. `packages/frontend/i18n/src/resources/*.json` 是否已经是最新文案
2. `packages/frontend/apps/electron/resources/web-static/js/i18n-langs.zh-Hans.*.js` 是否已经包含新文案
3. `packages/frontend/apps/electron/out/canary/make/nsis.windows/x64/AFFiNE-canary Setup 0.26.3.exe` 是否是最新生成时间
4. 安装目录 `C:\Users\xqyi\AppData\Local\Programs\AFFiNE-canary` 是否确实被新包覆盖

如果前两步没问题，后两步才是重点。

## 推荐的排查顺序

如果你只想最快定位问题，按下面顺序看就够了：

### A. 源资源

先确认中文资源文件里的值是对的：

- [`packages/frontend/i18n/src/resources/zh-Hans.json`](../packages/frontend/i18n/src/resources/zh-Hans.json)
- [`packages/frontend/i18n/src/resources/zh-Hant.json`](../packages/frontend/i18n/src/resources/zh-Hant.json)

### B. Electron 资源

再确认打包后生成的语言 chunk 里是不是已经包含正确中文：

- `packages/frontend/apps/electron/resources/web-static/js/i18n-langs.zh-Hans.*.js`
- `packages/frontend/apps/electron/resources/web-static/js/i18n-langs.zh-Hant.*.js`

### C. 安装包

然后确认打包产物和安装器是否都是最新版本：

- `packages/frontend/apps/electron/out/canary/`
- `packages/frontend/apps/electron/out/canary/make/nsis.windows/x64/`

### D. 运行时

最后启动安装后的 `AFFiNE-canary.exe`，看主进程是否还能正常起来。

## 这次已经验证过的可用命令

```powershell
node packages/frontend/apps/electron/scripts/generate-assets.ts
cmd /c C:\Users\xqyi\AFFiNE\node_modules\.bin\electron-forge.cmd package
node packages/frontend/apps/electron/scripts/make-nsis.ts
```

如果后续构建链路再有改动，建议先更新这份文档，再更新对应脚本和产物校验。
