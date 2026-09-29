# 会话交接

> 面向没有本次对话上下文的新会话。每次交接时更新前四节，只保留当前任务状态；“可累积避坑”保留经评估、对后续工作有指导意义的经验。记录坑项前，先标注是否属于架构级问题。
>
> **编译或打包前必读「编译打包流程」一节**，**尤其是最前面的「⚠️ 路径解析与询问规则」**——所有绝对路径都只是记录值，失效时先问用户，不要自己闷头找。

## 当前任务

- 0274 分支的字体改动（CJK 回退进入文档视图 + 标题阶梯 em 化）已实现、验证、提交并推送。
- Windows 打包已完成：免安装绿色包目录、portable zip、Squirrel Setup、NSIS Setup 四种产物齐备。
- 无阻塞项。用户明确本次只需 push，不需要 PR。

## 已完成

- **代码**（`fd7706437`）：`typography.css` 抽出 `--affine-cjk-stack`，把 `--affine-font-sans-family` 收敛为唯一 sans 定义并让 `--affine-font-family` 指向它——这是 CJK 回退能进入文档视图的关键，因为编辑器把 `--affine-font-family` 写成 slot 上的行内样式，优先级高于 `:root`；标题 h1–h6 改用 em 表达并共享 `--affine-line-height-heading`；段落块标题统一 `letter-spacing: normal`，标题内联代码由逐级阶梯收敛为 `calc(var(--affine-font-base) + 2px)`。
- **文档**（`ffeb4e060`）：`docs/custom-0.27.4.md` 刷新到 `HEAD=fd7706437`，补录 3 个漏记提交，修正 1.2 的过期行数与 1.1 的字体描述。
- **打包**：renderer 构建 → robocopy 同步 → build-layers → package-green → make-squirrel → make-nsis 全流程跑通，产物与验收见第 3、4 节。
- **冒烟**：绿色包以 `--user-data-dir=<临时目录>` 启动，7 个进程存活，`main.log` 无 error/warn。
- **推送**：`e591f4997..ffeb4e060  xqyi/0274 -> xqyi/0274`。

## 当前阻塞

无。

## 下一步计划

- 可选：开 PR（本次用户明确不需要）。
- 可选：合并上游 `canary`，冲突面评估见 `docs/custom-0.27.4.md` 第一、四节。

## 编译打包流程

> **执行任何编译或打包操作前，必须先完整阅读本节。** 本节记录 Windows 上从源码到可运行 `.exe` 的完整流程、依赖关系与验收标准。跳过中间步骤或只看最终目录，会产生"版本没变""图标是 Electron 的""还是旧代码"这类问题。

### ⚠️ 路径解析与询问规则（最高优先级，先于本节所有其他内容）

本节所有命令中出现的路径分两类，**必须区别对待**：

| 标记            | 含义                                                                | 处理方式                 |
| --------------- | ------------------------------------------------------------------- | ------------------------ |
| 🟢 **仓库相对** | 形如 `packages/frontend/apps/electron/scripts/xxx.ts`，相对于仓库根 | 可直接使用               |
| 🔴 **机器绝对** | 形如 `C:\node22\...`、`E:\AFFiNE\...`、`%APPDATA%\...`              | **必须先解析，禁止照抄** |

**规则（务必遵守）：**

1. **🔴 路径失效时，一律先向用户询问确认，不要自己闷头找。** 包括但不限于：`node.exe` 路径变了、仓库被移动/换名、Node 22 装在其他位置、之前打开文档属于另一个 checkout。
2. **禁止在多个 checkout 之间凭猜测选择工作目录。** 本机至少存在 `E:\AFFiNE\AFFiNE-0274`（当前项目）和 `E:\AFFiNE\AFFiNE`（另一份 checkout，**文档、AGENT.md、构建脚本位置均不同**）两个目录。**动笔写文档或执行命令前必须先确认当前工作区是哪一份**——本次就曾因把 handoff 文档写进 `E:\AFFiNE\AFFiNE` 而返工。
3. **开工前先做一次路径自检**，而不是等到命令报错才补救：

   ```powershell
   Write-Output "cwd      = $(Get-Location)"
   Write-Output "node22   = $(Test-Path 'C:\node22\node-v22.23.3-win-x64\node.exe')"
   Write-Output "repoRoot = $(Test-Path 'E:\AFFiNE\AFFiNE-0274\package.json')"
   Write-Output "runner   = $(Test-Path 'E:\AFFiNE\AFFiNE-0274\tools\cli\bin\runner.js')"
   ```

4. **任一项为 `False` 或仓库根不符，立刻停下询问用户**，说明你探测到了什么、期望是什么，不要自行猜测替代路径后继续。
5. **上表中的绝对路径是 2026-09-28 时的状态**，属于记录而非承诺。换机器、换会话、用户搬动目录后一律按本节重新解析。
6. 下文所有 🔴 路径均已就地标注。执行前逐条核对。

### 0. 前置：工具链

- **必须使用 Node.js 22.x**。系统默认 Node（v26 等）不满足仓库 `engines` 约束，原生构建与 rspack 均可能失败。执行前先 `node --version` 确认。
- 🔴 **Node 22 位置**：`C:\node22\node-v22.23.3-win-x64\node.exe`，下文记作 `$NODE22`。**此为 2026-09-28 记录值，失效则询问用户**，不要自行搜索或猜测。
- 🟢 **可以直接用 `yarn`**（2026-09-28 已安装 shim）。`C:\Users\xqyi\.yarn-shim` 已置于用户 PATH 最前，内含 `yarn` / `yarn.cmd` / `yarn.ps1` 与 `yarn-shim.mjs`：
  - 从当前目录向上找带 `packageManager: yarn@<v>` 的 `package.json`，运行该仓库 `.yarn\releases\yarn-<v>.cjs`；
  - 解释器固定为上面的 `$NODE22`，并把 Node 22 置于子进程 `PATH` 首位，因此 yarn 生命周期脚本里调用的 `node` 也是 v22 而不是系统默认的 v26；
  - 非 yarn 仓库下回退到 corepack；
  - 设了 `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`，无人值守场景（husky hook）不会卡在下载确认提示上。
  - 换机器或升级 Node 22 路径后需同步修改 `yarn-shim.mjs` 顶部的 `NODE22_DIR`。
  - **husky 的 `pre-commit`（`yarn lint-staged && yarn lint:ox`）现在可以正常跑，不要再默认加 `--no-verify`。** 注意 `lint-staged` 在「无暂存文件」时会以非 0 退出并中止 hook，因此空提交（`--allow-empty`）过不了 pre-commit，这是预期行为。
- 🟢 若 shim 不可用，仍可直接调用仓库内 release（`<repo>\.yarn\releases\yarn-*.cjs`，版本号可能随仓库变化，先 `Get-ChildItem .yarn\releases` 确认）：
  ```powershell
  & $NODE22 .yarn\releases\yarn-4.18.0.cjs <args>
  ```
- 🟢 涉及 `.ts` 脚本时需加 `--import tsx`，否则 `ERR_MODULE_NOT_FOUND`（扩展名省略的相对导入无法解析）：
  ```powershell
  & $NODE22 --import tsx packages/frontend/apps/electron/scripts/build-layers.ts
  ```
- 🔴 **工作目录必须是当前项目仓库根**（2026-09-28 为 `E:\AFFiNE\AFFiNE-0274`）。多数脚本按 `repoRootDir` 相对解析；**若不确定当前是哪个 checkout，先 `git rev-parse --show-toplevel` 确认，不要猜。**
- 🟢 长时间构建会超出单条命令超时，改用后台进程 + 轮询（`<repo>` 替换为确认后的仓库根）：
  ```powershell
  $p = Start-Process -FilePath $NODE22 -ArgumentList "..." -WorkingDirectory "<repo>" `
       -NoNewWindow -PassThru -RedirectStandardOutput "<repo>\.build.log" -RedirectStandardError "<repo>\.build.err.log"
  while (-not $p.HasExited) { Start-Sleep -Seconds 5 }
  ```

### 1. 关键前提：版本号烘焙进的是 renderer 工作区

**这是最容易踩的坑。** UI 关于对话框显示的版本来自：

`packages/frontend/core/.../about/index.tsx` → `BUILD_CONFIG.appVersion`
→ `getBuildConfig(new Package('@affine/electron-renderer'))`（`tools/utils/src/build-config.ts`，`appVersion: pkg.version`）
→ rspack `define` 静态注入 → 烘焙进 `electron-renderer/dist/js/*.js`

也就是说：

- **改 `packages/frontend/apps/electron/package.json` 的版本对 UI 显示无效**，它只影响 `app.getVersion()`。
- 只改 `package.json` 而不重新 bundle，UI 仍显示旧版本。
- 官方 `v0.27.4` tag 源码里各 workspace 就是 `0.27.0`，版本在发布时由 `scripts/set-version.sh` 注入。

验证方法（构建前先跑，确认将要烘焙的版本号）：

```powershell
& $NODE22 --import tsx -e "import { Package } from './tools/utils/src/workspace.ts'; import { getBuildConfig } from './tools/utils/src/build-config.ts'; console.log(getBuildConfig(new Package('@affine/electron-renderer'), { channel: 'canary', mode: 'production' }).appVersion);"
```

### 2. 完整流程（按序执行，不可跳步）

#### 步骤 1 — 统一所有 workspace 版本号

上游用 `scripts/set-version.sh`（依赖 `jq` + bash）。Windows 无此依赖，仓库内已提供 Node 等价实现 `scripts/set-version.mjs`：

```powershell
& $NODE22 scripts\set-version.mjs 0.27.4
```

> 🟢 `scripts/set-version.mjs` 是 2026-09-28 新增的未跟踪文件。**若换 checkout 或该文件不存在，不要临时手搓改 `package.json` 的脚本替代**，先询问用户如何设置版本号。
> 🟢 目标版本号不要照抄 `0.27.4`，按用户指定或 `git describe --tags` 确认。

它遍历 `yarn workspaces list --json` 的每个 `location`，把存在的 `package.json` 的 `version` 统一改写为目标版本（实测 122 个）。执行后确认：

```powershell
git grep -l '"version": "0.27.0"' -- "*/package.json"   # 应无输出
```

#### 步骤 2 — 构建 renderer

```powershell
$env:NODE_ENV = "production"
$p = Start-Process -FilePath $NODE22 `
     -ArgumentList "tools\cli\bin\runner.js affine.ts bundle -p electron-renderer" `
     -WorkingDirectory "<repo>" -NoNewWindow -PassThru `
     -RedirectStandardOutput "<repo>\.renderer-build.log" -RedirectStandardError "<repo>\.renderer-build.err.log"
while (-not $p.HasExited) { Start-Sleep -Seconds 5 }
```

- `runner.js` 的参数是**相对路径** `affine.ts`；传绝对路径会因被拼接到 cwd 后面而找不到文件。
- 也可以走 `yarn affine @affine/electron-renderer build`：`yarn` shim 装好后可用，`node_modules\.bin\affine.cmd` 指向 `@affine-tools/cli/bin/cli.js`。但 **2026-09-29 未复测该路径**，下文仍以 `runner.js` 为准。注意直接敲 `affine` 依然不可用（不在 PATH 上），只有经 `yarn` 才会解析到 `.bin`。
- 成功标志：日志出现 `compiled successfully` / `compiled with N warnings`，且 `electron-renderer/dist/js/` 下生成了新 hash 的 chunk。

#### 步骤 3 — 同步 web 资源到 Electron

> 🔴 **不要用 `SKIP_WEB_BUILD=true` + `generate-assets.ts` 来做同步——那样等于什么都不做。**

`scripts/generate-assets.ts` 里负责复制的 `fs.move` 写在 `if (!process.env.SKIP_WEB_BUILD)` 块**内部**（该文件第 47–63 行）：

```ts
if (!process.env.SKIP_WEB_BUILD) {
  spawnSync('yarn', ['affine', '@affine/electron-renderer', 'build'], ...);
  spawnSync('yarn', ['affine', '@affine/electron', 'build'], ...);
  await fs.move(affineWebOutDir, publicAffineOutDir, { overwrite: true });  // ← 同步在这里
}
```

所以 `SKIP_WEB_BUILD` 并不是"跳过重复构建、但仍然同步"，而是**连同步一起跳过**。设了它，脚本会打印一大段 `build with following variables {...}` 后以 `exit=0` 正常退出，`web-static` 却纹丝不动——**退出码 0 不代表同步成功**。

本机 `yarn` shim 已可用（见「0. 前置」），但 2026-09-29 未复测 `yarn affine`；稳妥路径仍是手动同步（与 `AGENT.md` 步骤 2 一致）：

```powershell
$src = "E:\AFFiNE\AFFiNE-0274\packages\frontend\apps\electron-renderer\dist"
$dst = "E:\AFFiNE\AFFiNE-0274\packages\frontend\apps\electron\resources\web-static"
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS
# exit 0–7 均算成功；>=8 才是真失败
```

> 使用 `robocopy /MIR` 而非 `Remove-Item`（后者在本机被系统策略拦截）。`/MIR` 会顺带删除目标目录里源已不存在的旧 chunk，这正是我们要的。

**校验（三条都要过，尤其第 1 条）**：

```powershell
# 1. 关键：确认 web-static 里的 chunk hash 与 renderer dist 一致
#    hash 不一致 = 同步没生效，打出来的是旧包
Get-ChildItem "packages\frontend\apps\electron-renderer\dist\js\5503*.js" | Select-Object Name
Get-ChildItem "packages\frontend\apps\electron\resources\web-static\js\5503*.js" | Select-Object Name

# 2. 确认烘焙的版本号
Select-String -Path "packages\frontend\apps\electron\resources\web-static\js\*.js" `
  -Pattern 'appVersion:"0\.27\.[0-9]+"' -AllMatches |
  ForEach-Object { $_.Matches.Value } | Sort-Object -Unique

# 3. 确认 index.html 的所有 script 引用都能解析（防孤儿/缺失 chunk）
$html = Get-Content "packages\frontend\apps\electron\resources\web-static\index.html" -Raw
$refs = [regex]::Matches($html, '(?:src|href)="([^"]+\.js)"') | ForEach-Object { $_.Groups[1].Value }
$missing = $refs | Where-Object { -not (Test-Path (Join-Path "packages\frontend\apps\electron\resources\web-static" ($_ -replace '^/',''))) }
if ($missing) { "MISSING: $($missing -join ', ')" } else { "all $($refs.Count) refs resolve" }
```

> **本次实际踩到**：照旧文档跑完，`generate-assets exit=0` 看着一切正常，但 web-static 最新 chunk 的时间戳还停在**上一次构建**（10:33 vs 本次 17:42），hash 是 `5503.448eb17e` 而非新构建的 `5503.7556a46e`——**包里根本没有本次改动**。只靠"脚本退出码"验收会直接漏掉这个问题。
>
> 另外 robocopy 输出里的 `*EXTRA File` 是目标目录的旧 chunk 被删除，属预期行为，不是错误。

#### 步骤 4 — 构建 Electron 主进程 layers

```powershell
& $NODE22 --import tsx packages\frontend\apps\electron\scripts\build-layers.ts
# -> Build layers done
```

生成 `dist/main.js` / `dist/helper.js` / preload 等。**这一步不含 renderer，单独跑它不会更新 UI。**

#### 步骤 5 — 绿色打包（免安装）

```powershell
# 0) 先结束残留实例：关窗口 != 退出进程，残留进程会锁住 out\canary 里的 exe/dll
Get-Process -Name AFFiNE-canary -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name AFFiNE-canary -ErrorAction SilentlyContinue   # 应返回空，再继续

# 1) 清空 out\canary。递归 Remove-Item 在本机被系统策略拦截，改用 robocopy /MIR 清空：
$empty = "$env:TEMP\affine-empty-wipe"; New-Item -ItemType Directory -Force -Path $empty | Out-Null
robocopy $empty packages\frontend\apps\electron\out\canary /MIR /NFL /NDL /NJH /NJS /NP   # exit 0-7 均成功

# 2) 打包
& $NODE22 --import tsx packages\frontend\apps\electron\scripts\package-green.ts
```

- **为什么必须先删 `out\canary`**：脚本用 `fs.copy(..., { overwrite: true })` 增量覆盖，不会删除旧文件。本次就曾残留一个未被 `index.html` 引用的孤儿包 `7592.77459062.js`（0.27.0），极易误判为"版本没生效"。清空重打是唯一可靠做法。
- 成功输出：
  ```
  embedded icon icon_canary.ico (rcedit: ...rcedit-x64.exe)
  set PE version strings: CompanyName=AFFiNE, FileDescription=AFFiNE-canary, ...
  verified: 4 icon image(s) present in AFFiNE-canary.exe (size ... -> ...)
  Green build ready: ...\out\canary\AFFiNE-canary-win32-x64
    staged runtime dependencies: argparse, builder-util-runtime, ... yjs
    exe icon/version resources: embedded
  ```

#### 步骤 6 — 安装包（Squirrel / NSIS）

两者都以步骤 5 产出的 `out\canary\AFFiNE-canary-win32-x64` 为输入，**必须在步骤 5 之后执行**。

```powershell
& $NODE22 --import tsx packages\frontend\apps\electron\scripts\make-squirrel.ts
& $NODE22 --import tsx packages\frontend\apps\electron\scripts\make-nsis.ts
```

- **Squirrel**：内部会调用 `fixSquirrelStubIcon()` 修执行桩图标并重新生成 Setup.exe，因此 Setup.exe 的时间戳会**晚于**同目录的 `-full.nupkg`，属正常现象。
- **`make-nsis.ts` 需要联网**下载 NSIS / 7zip 工具链（缓存在 `%LOCALAPPDATA%\electron-builder\Cache`）。2026-09-29 首次运行因 `ECONNRESET` 失败，重试即成功；失败时先确认缓存是否下全再重试。
- 🔴 **`make-nsis.ts` 失败时仍返回 exit 0**：脚本结尾是 `make().catch(e => console.error(e))`，错误只打印、不设退出码。**判据是 `out\canary\make\nsis.windows\x64\` 里有没有 `AFFiNE-canary Setup <version>.exe`**，不是退出码。
- 🔴 `make-nsis.ts` 中途失败会在**仓库根**留下 `AFFiNE-canary<随机串>\`（约 595 MB 的完整 app 副本）：它用 `fs.mkdtemp(appName)` 建在 CWD，而 cleanup 在 `buildForge` 之后。失败后手动清掉，别误提交。
- ⚠️ `make-squirrel.ts` 会往绿色包目录里**注入一个 `Squirrel.exe`**（约 1.95 MB，electron-winstaller 行为，时间戳晚于 `package-green`）。它不是 `package-green` 的产物；若之后要从该目录出纯绿色包或打 zip，注意这个多出来的文件。

#### 步骤 7 — 免安装 zip（可选）

绿色包目录本身就是可直接运行的免安装形态；要分发时打 zip 即可。用 `tar -a`（Windows 自带 bsdtar，按扩展名判定格式）远快于 `Compress-Archive`：

```powershell
Push-Location packages\frontend\apps\electron\out\canary
tar -a -cf AFFiNE-canary-0.27.4-portable-win32-x64.zip AFFiNE-canary-win32-x64
Pop-Location
# 实测 594.92 MB 目录 -> 242.09 MB zip，约 30 秒
```

> 先把 `Push-Location` 切到父目录并传**相对目录名**，zip 内才会带顶层目录，解压不会散落一地。

### 3. 产物位置

🔴 **绝对路径（2026-09-29 记录）。`<repo>` = `packages\frontend\apps\electron`，`<ver>` = 当前应用版本（本次 `0.27.4`）。一律用相对形式定位，不要照抄本机路径。**

| 产物             | 相对路径                                                                    | 本次实测大小 |
| ---------------- | --------------------------------------------------------------------------- | ------------ |
| 绿色包目录       | `<repo>\out\canary\AFFiNE-canary-win32-x64\`（入口 `AFFiNE-canary.exe`）    | 594.92 MB    |
| 免安装 zip       | `<repo>\out\canary\AFFiNE-canary-<ver>-portable-win32-x64.zip`              | 242.09 MB    |
| Squirrel 安装包  | `<repo>\out\canary\make\squirrel.windows\x64\AFFiNE-canary-<ver> Setup.exe` | 235.25 MB    |
| Squirrel full 包 | 同目录 `AFFiNE-canary-<ver>-full.nupkg` + `RELEASES`                        | 234.81 MB    |
| NSIS 安装包      | `<repo>\out\canary\make\nsis.windows\x64\AFFiNE-canary Setup <ver>.exe`     | 176.84 MB    |

- 绿色包双击即可运行，无需安装器；`out\` 下只有 `canary`（未构建 stable）。
- 体积随构建浮动，仅作量级参考；用 `Get-ChildItem ... | Select-Object Name, Length, LastWriteTime` 现场取值。

### 4. 验收标准（三条硬信号 + 静态校验）

**静态校验（打包后立即执行，比启动验证快）：**

| 检查项      | 命令                                                                                                 | 期望                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 同步生效    | 比对 `<renderer>\dist\js\<chunk>.js` 与 `<app>\resources\web-static\js\<chunk>.js` 的**文件名 hash** | 两者完全相同（hash 不同 = 打的是旧包，见「常见误判」）                                                                                                 |
| 改动已入包  | `Select-String <app>\resources\web-static\js\*.js -Pattern '<本次改动的特征串>'`                     | 有命中                                                                                                                                                 |
| 应用版本    | `Get-Content <app>\package.json`                                                                     | `"version": "0.27.4"`                                                                                                                                  |
| 烘焙版本    | `Select-String <app>\resources\web-static\js\7592.*.js -Pattern 'appVersion:"0\.27\.[0-9]+"'`        | `0.27.4`                                                                                                                                               |
| 无孤儿包    | `Get-ChildItem <app>\resources\web-static\js -Filter "*7592*"`                                       | 只有一个 chunk hash                                                                                                                                    |
| 入口一致    | `Select-String <app>\resources\web-static\index.html -Pattern '7592'`                                | 指向新 hash                                                                                                                                            |
| PE 元数据   | `(Get-Item <exe>).VersionInfo`                                                                       | `ProductName/InternalName=AFFiNE-canary`、`CompanyName=AFFiNE`                                                                                         |
| 图标        | 见下方命令                                                                                           | `verified: 4 icon image(s) present`                                                                                                                    |
| 安装包图标  | 解包 `-full.nupkg`，逐张比对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 的 ICO 图像                 | 逐张命中（本次 4/4）                                                                                                                                   |
| NSIS 元数据 | `(Get-Item "<NSIS Setup.exe>").VersionInfo`                                                          | `ProductName=AFFiNE-canary`、`FileVersion=<ver>`、`CompanyName=toeverything`（与绿包/Squirrel 的 `CompanyName=AFFiNE` 不同，属 electron-builder 行为） |

> 🟢 `<app>` = `<repo>\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\resources\app`
> 🟢 `<exe>` = `<repo>\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\AFFiNE-canary.exe`
> 🟢 `7592` 是 chunk 名，**可能随构建变化**；先用 `Select-String ...index.html -Pattern 'js/\d+\.'` 取当前实际入口，不要假定永远是 7592。

图标校验命令：

```powershell
& $NODE22 packages\frontend\apps\electron\scripts\embed-exe-icon.mjs <exe> `
  --icon packages\frontend\apps\electron\resources\icons\icon_canary.ico `
  --product-name AFFiNE-canary --verify-only
```

> 🟢 `embed-exe-icon.mjs` 的 `--verify-only` 仍**要求**同时传 `--icon` 和 `--product-name`，否则报 `--icon <ico> is required`。
> 🟢 该脚本在 `packages/frontend/apps/electron/scripts/`，**不在仓库根 `scripts/`**。若报找不到文件，先 `Get-ChildItem -Recurse -Filter embed-exe-icon.mjs` 确认实际位置再询问，不要在其他 checkout 里乱找。

**运行冒烟：**

- 🔴 日志路径 `%APPDATA%\AFFiNE-canary\logs\main.log`（`%APPDATA%` 由 Windows 解析，**productName 随构建类型变化**：stable 为 `AFFiNE`）。找不到日志目录时先确认实际 productName，不要直接断定启动失败。
- 🟢 冒烟测试用 `--user-data-dir=<临时目录>` 启动独立实例，避免单实例锁与真实数据污染（见「可累积避坑」相关条目）。
- 🟢 启动后到「设置 → 关于」确认显示 `0.27.4`。

### 5. 常见误判

- **同步步骤"成功退出"不等于 web-static 已更新**——见「可累积避坑 → 同步 renderer 产物时，"跳过构建"不等于"仍然同步"」。`SKIP_WEB_BUILD` 会连 `fs.move` 一起跳过，脚本仍 `exit=0`。**必须比对 chunk hash**，不能只看退出码。
- **renderer dist 与 web-static 的 chunk hash 不一致** = 同步没生效。hash 变了而 web-static 的还是旧的，说明本次改动根本没进包，重新同步后再打包。
- **`dist/main.js` / `helper.js` 里搜到 `0.27.0` 属正常**——那是 napi-rs 的 `bindingPackageVersion !== "0.27.0"` 版本校验字符串，与应用版本无关。
- **Windows 任务栏图标只认 exe 内嵌 PE 资源**。rcedit 必须在打包时执行；绿色包已内置。若想换成正式版黑色菱形图标，把 `package-green.ts` 中 `buildType === 'stable' ? 'icon.ico' : icon_${buildType}.ico` 改为固定 `icon.ico`（行号会随文件改动漂移，用 `Select-String -Pattern "iconName"` 定位，**不要照抄行号 237**）。
- **Canary 图标在资源管理器 16×16 缩略下像 Electron 原子图标**——这是正常观感：金色轨道徽标在小尺寸下字母被抹掉、只剩轨道环。不是图标嵌入失败。
- 🟢 `.native-build.log` / `.renderer-build.log` 等是临时日志，位于**仓库根**且未被 git 跟踪，可随手删除；用完应清理以免污染工作区。
- **`make-nsis.ts` 失败也返回 exit 0**——见「可累积避坑 → 打包脚本用 catch 吞掉错误码」。判据是 `out\canary\make\nsis.windows\x64\` 里有没有 Setup.exe，不是退出码。
- **NSIS 产物的 `CompanyName` 是 `toeverything`、`FileVersion` 是应用版本**，与绿色包/Squirrel 的 `CompanyName=AFFiNE` 不一致。这是 electron-builder 按 `package.json` 元数据写入的结果，不是打包缺陷。
- **绿色包目录里多出一个 `Squirrel.exe`（约 1.95 MB）**——那是打 Squirrel 包时 electron-winstaller 注入的，不属于 `package-green` 的产物。

### 6. 与本流程配套的避坑条目

以下「可累积避坑」条目与本流程直接相关，排查打包问题时务必对照阅读：

- 「桌面构建产物有明确的组件边界」
- 「同步 renderer 产物时，"跳过构建"不等于"仍然同步"」
- 「esbuild external 不会进 bundle，必须随包提供运行时 node_modules」
- 「残留 app.asar 会优先于 resources/app 被加载」
- 「原生 .node 必须与当前源码同一次构建」
- 「Windows 任务栏图标只认 exe 内嵌资源，绿色包重打包会把它覆盖掉」
- 「单实例锁会让"双击没反应"，冒烟测试用独立 user-data-dir」
- 「本机路径和应用版本不要固化到可复用命令」
- 「关闭窗口不等于退出进程，残留实例会锁住 out 目录」
- 「打包脚本用 catch 吞掉错误码，退出码 0 不代表打包成功」
- 「NSIS 打包失败会在仓库根留下完整 app 副本」
- 「Squirrel 打包会往绿色包目录注入 Squirrel.exe」
- 「免安装 zip 用 tar -a 生成，不要用 Compress-Archive」

## 可累积避坑

以下条目依据本次查阅的仓库文档和脚本记录。架构级指涉及组件边界或构建依赖关系、会影响后续设计或改动顺序的经验；机器路径、工具版本和单次构建故障不属于架构级。

### 同步 renderer 产物时，"跳过构建"不等于"仍然同步"

- **架构级：是。** `packages/frontend/apps/electron/scripts/generate-assets.ts` 把 `fs.move(dist → resources/web-static)` 写在 `if (!process.env.SKIP_WEB_BUILD)` 块内部。设 `SKIP_WEB_BUILD` 会连同步一起跳过，而脚本仍打印变量表并以 `exit=0` 正常退出——**退出码 0 不代表同步成功**。在这种"复制动作被条件包裹"的脚本上，不能用退出码替代对产物的实际校验。
- 正确做法：跳过 renderer 重复构建后，用 `robocopy <renderer>\dist <electron>\resources\web-static /MIR` 手动同步，并核对两处 chunk **hash 一致**；hash 不一致即说明打的是旧包。`/MIR` 顺带清掉目标目录里的旧 chunk（robocopy 输出的 `*EXTRA File` 是删除动作，非错误）。
- 详见「编译打包流程 → 步骤 3」。

### 桌面构建产物有明确的组件边界

- **架构级：是。** 桌面客户端由 web/core、Rust native modules 和 Electron 应用构成；Electron 依赖前两者的产物。修改 renderer/UI 后必须重新构建 renderer，并将其产物同步到 Electron 使用的 web-static，再打包；只构建 Electron 主进程不会更新 renderer UI。
- 依据：[桌面客户端构建指南](building-desktop-client-app.md)及本次审阅的 `AGENT.md`。改动构建拓扑时应同时检查 CI 的桌面发布 workflow。

### Windows 手动打包绕过 forge 时，必须验证最终产物

- **架构级：否。** `AGENT.md` 记录 Windows 上 forge package 可能受 Yarn 安装布局/链接影响，需手动构造打包目录。此为平台与工具链限制，不是应用架构保证；执行前应检查当前 Yarn 配置、forge 错误和官方 CI 流程，不要把本机绕过方案视为通用流程。
- 手动复制 Electron 可执行文件会遗漏应用图标、版本资源、`productName` 或应用资源目录。若采用手动打包，需按当前产品配置补齐，并验证最终安装包而不只检查中间目录。

### Squirrel delta 包需要可用的 full 包基线

- **架构级：否。** 本地没有旧版 full nupkg 基线时，delta 生成可能失败；按当前 `make-squirrel` 配置选择提供基线或启用 `noDelta`。不要因为旧 Setup.exe 仍存在就判定本次打包成功，应检查新产物的时间戳和内容。

### Squirrel stub 图标修复需验证是否实际执行

- **架构级：否。** `make-squirrel.ts` 会调用 stub 图标修复，但修复脚本在缺少 `rcedit-full` 或图标时会跳过。确认前置文件存在，并检查 full nupkg 内的 `lib/net45/*_ExecutionStub.exe`；用 ICO 目录解析出每张图像数据后逐张比对，避免以完整 ICO 文件或固定文件头搜索作判断。

### 不要混用不同 rcedit 版本的参数

- **架构级：否。** 当前 `AGENT.md` 对精简版与完整版 rcedit 的能力、版本和参数写法互相矛盾。执行图标/版本资源操作前，先确认所调用的二进制及其支持参数；不要将精简版的 `--set-icon` 能力推断为支持版本字符串选项。应先统一并实际验证仓库内的操作说明。

### 本机路径和应用版本不要固化到可复用命令

- **架构级：否。** `AGENT.md` 中存在机器专属绝对路径和固定应用版本号。新会话应先从仓库位置、`package.json`、当前构建类型和实际输出目录解析值，避免复制旧版本命令导致读写错目录或验证错包。

### 编译和打包使用 Node.js 22.x

- **架构级：否。** 本仓库的编译/打包流程必须使用 Node.js 22.x；其他主版本可能不满足仓库的 `engines` 或原生构建工具要求。运行前先确认 `node --version` 为 22.x，并从当前机器的实际安装位置调用 Node，不要照搬其他开发机的绝对路径。

### 手工打包必须遵循 package.json 的入口路径

- **架构级：否。** Electron `package.json` 的 `main` 是 `dist/main.js`；手工构造 `resources/app` 时，把 bundle 只复制到 `resources/app/main.js` 不会替换实际入口，旧的 `dist/main.js`/`dist/helper.js` 仍可能被加载。将整个当前 `dist/` 镜像到 `resources/app/dist/`，并在生成安装包后核对 nupkg 内实际入口 bundle 与本次构建哈希一致。

### Sync 协议升级必须保留旧版兼容路径

- **架构级：是。** AFFiNE Server 0.27.4 官方源码实现旧 `space:join`，当前 canary 已验证该事件与根文档只读请求成功；0.27.5 server 才使用 batch sync 事件。产品版本 0.27.x 的兼容承诺不代表同步事件协议完全相同。客户端现按 server version 在 legacy 和 batch doc/awareness join 路径间选择；改协议时需保留旧版回退并覆盖跨版本测试。

### Windows 绿色（免安装）打包的固定顺序与验收信号

- **架构级：是。** `resources/app` 由五块互相独立的产物拼成：renderer bundle、`build-layers` 生成的主进程/helper/preload bundle（含拷入的 `affine.<platform>-<arch>-msvc.node`）、运行时 `node_modules` 闭包、`package.json`（含注入的 `productName`）、以及外层 Electron runtime（exe/locales/_.bin/_.dll/*.pak）。顺序固定，跳步得到的都是“能启动、随后报错或白屏”的包：
  1. 构建 renderer，产物同步到 `packages/frontend/apps/electron/resources/web-static`；只构建 Electron 主进程不会更新 UI。
  2. 用 Node.js 22.x 在 `packages/frontend/apps/electron` 运行 `build-layers`，产物落在 `dist/`（`main.js`、`helper.js`、`preload.js` 及 native `.node`）。
  3. 组装 `resources/app`：整个 `dist/` 镜像进去；复制 `package.json` 并注入 `productName`（canary=`AFFiNE-canary`，stable=`AFFiNE`）；复制 `resources/icons`、`resources/web-static`、`app-update.yml`。
  4. 补齐运行时 `node_modules` 闭包（见下一条）。
  5. 拷入 Electron runtime：`electron.exe`（改名为 `<productName>.exe`）、`locales/`、`snapshot_blob.bin`、`v8_context_snapshot.bin`、`icudtl.dat`、需要的 dll 与 pak。
  6. rcedit 嵌入图标与 PE 版本信息（必须在 `make` 之前，否则 Setup.exe 内的 exe 仍是 Electron 图标）。
  7. 验收三条硬信号：① 产物目录内直接双击 exe 能起；② `%APPDATA%\<productName>\logs\main.log` 出现 `Updater configured!`，且没有 `[helper] process exited { code: 1 }`；③ 自包含校验通过（每个 external 都能从 app 目录内部解析到）。
- 依据：`AGENT.md` 步骤 3–5 与本次实测日志（`create window` → `Initializing tray` → `[helper] forked <pid>` → `view shell created` → `Updater configured!` → `main window is ready to show`）。

### esbuild external 不会进 bundle，必须随包提供运行时 node_modules

- **架构级：是。** `packages/frontend/apps/electron/scripts/common.ts` 中 `external: ['electron', 'electron-updater', 'yjs', 'semver']`，这些包不会被打进 `dist/main.js` / `dist/helper.js`。`resources/app/node_modules` 里没有真实副本时，exe 启动即弹 `A JavaScript error occurred in the main process / Error: Cannot find module 'electron-updater'`（`main.js` 内确有 `require("electron-updater")`、`require("electron-updater/out/providers/Provider")`、`require("electron-updater/out/DownloadedUpdateHelper")`）。
- 补齐命令（幂等、不覆盖 exe）：`node ./scripts/stage-runtime-deps.mjs "<resources/app 目录>" "<仓库根>"`。脚本扫描 `dist/*.js` 中的 `require('...')`，按 Node 的解析顺序（父包自带 `node_modules` 优先于提升到仓库根的版本）复制 `electron-updater`、`yjs`、`semver` 及其传递依赖，共 19 个包：electron-updater, builder-util-runtime, fs-extra, js-yaml, jsonfile, universalify, graceful-fs, lazy-val, lodash.escaperegexp, lodash.isequal, tiny-typed-emitter, semver, sax, argparse, debug, ms, yjs, lib0, isomorphic.js；结束时逐个校验模块能否从 app 目录内部解析到，解析到目录外即非 0 退出。
- **不要用“本机能跑”判断包是否完整。** `resources/app/dist` 仍位于仓库根之下，Node 逐级向上查找 `node_modules` 时会意外命中 `<repo>/node_modules`，于是本机侥幸不报错；把目录移走、拷到别处或由 Squirrel 装到 `%LOCALAPPDATA%\<productName>\app-<version>` 后这条路径消失，错误必现。

### 残留 app.asar 会优先于 resources/app 被加载

- **架构级：否。** Electron 先找 `resources/app.asar`，其次才是 `resources/app`。上一次 forge/asar 打包残留的 asar 会让绿色包继续加载旧代码（同样表现为 `Cannot find module '...'`）。组装绿色包时应删除 `resources/app.asar`、`resources/app.asar.unpacked`、`resources/default_app.asar`；AFFiNE-0274 checkout 的 `scripts/package-green.ts` 已内置该清理与依赖暂存。

### 原生 .node 必须与当前源码同一次构建

- **架构级：是。** 从其他仓库或版本拷来的 `affine.<platform>-<arch>-msvc.node` 可能缺少当前 JS 期望的导出（例如 `DocStoragePool.getDocSnapshot`）。表现为主进程能建窗口，但 helper 立刻退出：日志中 `[helper] forked <pid>` 紧跟 `[helper] process exited { code: 1 }`，之后不再出现 `view shell created` / `Updater configured!`，窗口空白。必须用当前源码重新执行 napi build，并把新产物同步进 `dist/` 后再打包。

### 单实例锁会让“双击没反应”，冒烟测试用独立 user-data-dir

- **架构级：否。** `src/main/index.ts` 使用 `app.requestSingleInstanceLock()`；已有实例（包括从另一个 checkout 启动的同名 productName 实例）时，新进程会立即 `app.quit()` 且没有任何提示，容易被误判成“包坏了”。验证新包前先退出正在运行的实例；或用 `--user-data-dir=<临时目录>` 启动独立实例做冒烟测试（canary/stable 默认 userData 为 `%APPDATA%\<productName>`，用临时目录可避免污染真实数据）。

### Windows 任务栏图标只认 exe 内嵌资源，绿色包重打包会把它覆盖掉

- **架构级：是。** 主进程只在 Linux 调用 `browserWindow.setIcon()`（`src/main/windows-manager/main-window.ts` 里 `if (isLinux())`），Windows 的窗口/任务栏图标完全取自 **exe 的 PE 图标资源**。而 `package-green` 和手动流程都是原样拷贝 `node_modules/electron/dist/electron.exe`，拷完不跑 rcedit 就还是 Electron 图标（本机症状：打包 exe 与 electron.exe 大小、mtime 完全一致，`VersionInfo` 为 `ProductName=Electron` / `CompanyName=GitHub, Inc.`）。
- 修复：拷贝 exe 之后、`make` 之前执行
  `node ./scripts/embed-exe-icon.mjs <exe> --icon resources/icons/icon_<buildType>.ico --product-name <productName>`
  脚本自动挑 `rcedit-full`、写入图标与 4 个 version string，并逐张校验 ico 的每张图已落进 PE（`--verify-only` 只校验不修改）。AFFiNE-0274 的 `package-green` 已内置该步骤，末尾打印 `exe icon/version resources: embedded`。
- 两个易混点：① 这一步必须在 `make` 之前完成，否则 Setup.exe/nupkg 里的 exe 仍是 Electron 图标；② 目标 exe 被运行中的实例占用时 rcedit 报 `Fatal error: Unable to commit changes`（locks），先退出应用再嵌，`--verify-only` 不受影响。
- 验收：`AFFiNE-canary.exe` 由 210896896 变为 210913280 字节（+16KB），`VersionInfo` 变为 `ProductName/InternalName=AFFiNE-canary`、`CompanyName=AFFiNE`，脚本输出 `verified: 4 icon image(s) present`。注意 Squirrel 安装场景还要额外修执行桩（见「Squirrel 执行桩不继承 app 图标」一条），绿色包不需要。

### 关闭窗口不等于退出进程，残留实例会锁住 out 目录

- **架构级：否。** Electron 应用关掉窗口后进程可能继续存活（托盘、helper、renderer 都算）。2026-09-29 实测：用户已关闭窗口，仍有 7 个 `AFFiNE-canary` 进程存活，导致清空 `out\canary` 时报 `ERROR 5 (Access is denied)` 与 `ERROR 32 (being used by another process)`——被占用的是 `.exe`、`.dll` 与 `v8_context_snapshot.bin`。
- 重新打包前先结束实例并确认归零：`Get-Process -Name AFFiNE-canary -ErrorAction SilentlyContinue | Stop-Process -Force`，再 `Get-Process -Name AFFiNE-canary` 应返回空。

### 打包脚本用 catch 吞掉错误码，退出码 0 不代表打包成功

- **架构级：否。** `make-squirrel.ts` 与 `make-nsis.ts` 都以 `make().catch(e => console.error(e))` 结尾：错误只打到 stderr，进程仍以 0 退出。2026-09-29 实测 `make-nsis.ts` 因 `ECONNRESET` 下载工具链失败，`MAKE_NSIS_EXIT=0`，而 `out\canary\make\nsis.windows\x64\` 里没有任何产物。
- 凡"脚本尾部捕获异常"的打包脚本，验收一律以**产物是否存在**为准，不看退出码。这与「同步 renderer 产物时，跳过构建不等于仍然同步」是同一类问题。

### NSIS 打包失败会在仓库根留下完整 app 副本

- **架构级：否。** `make-nsis.ts` 用 `fs.mkdtemp(appName)` 在 CWD（即仓库根）建临时目录、把整个绿色包 `fs.copy` 进去、最后 `fs.remove(tmpPath)`。中途失败就跳过 cleanup，留下 `AFFiNE-canary<随机串>\`（本次 594.92 MB / 2575 项）。
- 它会出现在 `git status` 的未跟踪列表里，别误提交；清空用 `robocopy <空目录> <目标> /MIR`（递归 `Remove-Item` 在本机被系统策略拦截）。

### Squirrel 打包会往绿色包目录注入 Squirrel.exe

- **架构级：否。** `make-squirrel.ts` 经 electron-winstaller 组包时，会把 `Squirrel.exe`（约 1.95 MB）写进 `out\<buildType>\<productName>-<platform>-<arch>\`。它的时间戳晚于 `package-green` 的产物，不属于绿色包本身。
- 先打绿色包、再打 Squirrel 时最容易忽略；若要交付纯绿色包或据该目录打 zip，需先决定是否剔除它。

### 免安装 zip 用 tar -a 生成，不要用 Compress-Archive

- **架构级：否。** `tar -a -cf <name>.zip <dir>`（Windows 自带 bsdtar，按扩展名判定格式）打 595 MB 目录约 30 秒；`Compress-Archive` 在同量级下慢一个数量级。
- 先把 `Push-Location` 切到父目录并传**相对目录名**，zip 内才会带顶层目录，解压不会散落一地。
