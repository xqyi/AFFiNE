# AGENT.md - AFFiNE Electron 编译打包指南

## 环境要求

- **Node.js 22**（必须使用 `C:\node22\node-v22.23.3-win-x64`）
  - 系统默认 Node 为 v26.7.0，不满足项目 engines 要求 (`>=22.12.0 <23.0.0`)
  - 所有构建命令必须使用 Node 22 的 node.exe
- **Yarn 4.18.0**（通过 `.yarn/releases/yarn-4.18.0.cjs` 调用）
  - 仓库使用 yarn 4 workspaces，yarn 不在系统 PATH 中
- **Windows PowerShell**

## 路径约定

```
REPO_ROOT   = E:\AFFiNE\AFFiNE
ELECTRON_DIR = E:\AFFiNE\AFFiNE\packages\frontend\apps\electron
NODE22      = C:\node22\node-v22.23.3-win-x64\node.exe
YARN        = E:\AFFiNE\AFFiNE\.yarn\releases\yarn-4.18.0.cjs
FORGE_CLI   = E:\AFFiNE\AFFiNE\node_modules\@electron-forge\cli\dist\electron-forge.js
```

### 4.5. 用 rcedit 把 AFFiNE 图标嵌入到 exe（必须在步骤 5 之前）

手动 `Copy-Item electron.exe` 不会嵌入自定义图标，不补这一步 exe 会显示 Electron 默认图标。

**重要：** 项目里 `node_modules/electron-winstaller/vendor/rcedit.exe` 是**精简版**，只认 `--set-icon`，**不支持**改版本元数据。要改 `ProductName`/`CompanyName` 等（Squirrel 生成快捷方式名/图标时读它），必须用**完整版 rcedit v2.0.0**（`rcedit` npm 包，带 `--set-version-string`）。完整版已下载到 `node_modules/electron-winstaller/vendor/rcedit-full/package/bin/rcedit-x64.exe`。

为什么必须改元数据：Squirrel 在每台机器安装时，从主程序 exe 的 `ProductName`/`CompanyName` 决定快捷方式显示名与文件夹。若 `ProductName=Electron`、`CompanyName=GitHub, Inc.`，装完开始菜单就会是 `GitHub, Inc.\Electron.lnk`、任务栏 Electron 图标——**换任何机器都复现**。把主程序 exe（`out/canary/.../AFFiNE-canary.exe`，会被塞进 nupkg）的图标和元数据都改对，分发后任意机器装完即正确。

```powershell
cd $ELECTRON_DIR
$exe    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\AFFiNE-canary.exe"
$ico    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\icons\icon_canary.ico"
$rcedit = "E:\AFFiNE\AFFiNE\node_modules\electron-winstaller\vendor\rcedit-full\package\bin\rcedit-x64.exe"   # 完整版

# 1) 嵌图标（完整版 rcedit 用 --set-icon）
& $rcedit $exe --set-icon $ico
# 2) 改 PE 版本信息字符串（Squirrel 快捷方式名/图标依赖这些）
& $rcedit $exe --set-version-string "CompanyName" "AFFiNE"
& $rcedit $exe --set-version-string "FileDescription" "AFFiNE-canary"
& $rcedit $exe --set-version-string "InternalName" "AFFiNE-canary"
& $rcedit $exe --set-version-string "ProductName" "AFFiNE-canary"
# 稳定版把上面四个值改成 "AFFiNE"（图标用 icon.ico）。
```

**若本机还没有完整版 rcedit**（`rcedit-full/` 不存在），先下载 `rcedit@5.0.2` 的 tarball 解包：

```powershell
& $NODE22 -e "(async()=>{const r=await fetch('https://registry.npmjs.org/rcedit/-/rcedit-5.0.2.tgz');const b=Buffer.from(await r.arrayBuffer());require('fs').writeFileSync('E:/AFFiNE/AFFiNE/node_modules/electron-winstaller/vendor/rcedit-full/rcedit-5.0.2.tgz',b)})()"
tar -xzf node_modules/electron-winstaller/vendor/rcedit-full/rcedit-5.0.2.tgz -C node_modules/electron-winstaller/vendor/rcedit-full
# 产物在 node_modules/electron-winstaller/vendor/rcedit-full/package/bin/rcedit-x64.exe
```

注意：`rcedit` 完整版与精简版共存时，步骤 4.5 一律用 `rcedit-full` 那个；`vendor/rcedit.exe`（精简版）仅 `--set-icon` 够用，不能改元数据。

```powershell
cd $ELECTRON_DIR
$exe    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\AFFiNE-canary.exe"
$ico    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\icons\icon_canary.ico"
$rcedit = "E:\AFFiNE\AFFiNE\node_modules\electron-winstaller\vendor\rcedit.exe"
# 不只嵌图标，还要把 PE 元数据改成 AFFiNE。Squirrel 生成快捷方式/根 shim 时
# 读主程序 exe 的 ProductName/CompanyName 来决定显示名——不改的话，每台机器
# 装完开始菜单都会叫 “GitHub, Inc.\Electron.lnk”，任务栏也是 Electron 图标。
& $rcedit $exe --set-icon $ico --set-product-name "AFFiNE-canary" --set-file-description "AFFiNE-canary" --set-internal-name "AFFiNE-canary" --set-company-name "AFFiNE"   # exitcode=0 成功
# 稳定版把上面四个 --set-* 值改成 "AFFiNE" 即可（图标用 icon.ico）。
# 注意：改的是 out/canary/.../AFFiNE-canary.exe（会被塞进 nupkg 的主程序 exe），
# 这样 Squirrel 在每台机器上安装时会据此生成正确的快捷方式名与图标。
```

验证：嵌入后 exe 大小约 +16KB、mtime 更新（正常现象，`VersionInfo` 仍显示 Electron，rcedit 只改图标资源）；资源管理器里 exe 图标变为 AFFiNE。

或手动验证：解包 full nupkg，对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 按 ico 头解析出每张图的 offset/size，取前 16 字节逐张 `indexOf`（rcedit 把 ico 拆成多张 RT_ICON 资源嵌入，搜完整 ico 文件或 ico 头 8 字节都会漏判）。

### 5. 生成 Squirrel 安装包

本机直接跑 `make-squirrel.ts` 会在 delta 阶段失败（**坑 3**：`The base package release does not exist`，因为 out 目录里没有旧版 full nupkg 基线，`remoteReleases` 也没有配）。此时改用 `noDelta: true` 的等价调用（步骤 5 的 `--import tsx -e` 内联脚本），**并手动补跑一次 fix-squirrel-stub-icon**（内联脚本绕过了 `make-squirrel.ts` 的自动 hook）：

```powershell
cd $ELECTRON_DIR
& $NODE22 --import tsx -e 'import("./scripts/fix-squirrel-stub-icon.ts").then(m => m.fixSquirrelStubIcon())'
```

正常情况直接跑 `make-squirrel.ts` 即可（delta 生成正常），它会在 `createWindowsInstaller` 之后自动调 `fix-squirrel-stub-icon.ts`（见坑 9）。

## 编译打包步骤（按顺序执行）

### 1. 构建渲染层（Web 前端产物）

```powershell
cd $ELECTRON_DIR
& $NODE22 $YARN workspace @affine/electron-renderer build
```

产物落在 `packages/frontend/apps/electron-renderer/dist`。

### 2. 同步 Web 产物到 Electron resources

```powershell
$src = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron-renderer\dist"
$dst = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\web-static"
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS
```

> 使用 `robocopy /MIR` 而非 `Remove-Item`（后者被系统策略拦截）。

### 3. 构建 Electron 主进程

```powershell
cd $ELECTRON_DIR
& $NODE22 --import tsx ./scripts/build-layers.ts
```

产物落在 `packages/frontend/apps/electron/dist/main.js`。

### 4. 手动构造 forge 打包目录

Windows 上 forge `package` 会因 `node_modules` 软链接问题失败（`ENOENT: stat '...\resources\app\node_modules'`），需要手动构造：

```powershell
cd $ELECTRON_DIR
$appDir = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64"
$resourcesApp = "$appDir\resources\app"
$electronDist = "E:\AFFiNE\AFFiNE\node_modules\electron\dist"

# 创建目录结构
New-Item -ItemType Directory -Path $resourcesApp -Force | Out-Null

# 复制 main.js 到 resources/app
Copy-Item "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\dist\main.js" "$resourcesApp\main.js" -Force

# 复制 electron 的 package.json 到 resources/app
Copy-Item "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\package.json" "$resourcesApp\package.json" -Force

# 注入 productName（模拟 forge readPackageJson hook；canary build）。
# 不做这步 app.name 回退到 name='@affine/electron'，主窗口标题会显示 @affine/electron。
& $NODE22 -e 'import("node:fs").then(m=>{const p=process.argv[1];const j=JSON.parse(m.readFileSync(p,"utf8"));j.productName="AFFiNE-canary";m.writeFileSync(p,JSON.stringify(j,null,2));console.log("productName->",j.productName)})' "$resourcesApp\package.json"
# 稳定版（stable）应改为 "AFFiNE"。

# 复制 icons 到 resources/app/resources/icons（主进程托盘/窗口图标依赖，缺了会回退 Electron 默认）
robocopy "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\icons" "$resourcesApp\resources\icons" /E /NFL /NDL /NJH /NJS

# 复制 web-static 到 resources/app
robocopy "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\web-static" "$resourcesApp\resources\web-static" /MIR /NFL /NDL /NJH /NJS

# 复制 electron 可执行文件
Copy-Item "$electronDist\electron.exe" "$appDir\AFFiNE-canary.exe" -Force

# 复制 locales
robocopy "$electronDist\locales" "$appDir\locales" /MIR /NFL /NDL /NJH /NJS

# 复制必要 dll 和 dat
foreach ($f in @("icudtl.dat","d3dcompiler_47.dll","ffmpeg.dll","libEGL.dll","libGLESv2.dll")) {
    if (Test-Path "$electronDist\$f") { Copy-Item "$electronDist\$f" "$appDir\$f" -Force }
}

# 复制 LICENSE
Copy-Item "E:\AFFiNE\AFFiNE\LICENSE" "$appDir\LICENSE" -Force
```

### 4.5. 用 rcedit 把 AFFiNE 图标嵌入到主 exe（必须在步骤 5 之前）

手动 `Copy-Item electron.exe` 不会嵌入自定义图标，不补这一步 exe 会显示 Electron 默认图标。Squirrel 在每台机器安装时，从主 exe 的 `ProductName`/`CompanyName` 决定快捷方式显示名与文件夹；不改的话，装完开始菜单会叫 `GitHub, Inc.\Electron.lnk`，任务栏也是 Electron 图标——**换任何机器都复现**。

**重要：** 项目里 `node_modules/electron-winstaller/vendor/rcedit.exe` 是**精简版**，只认 `--set-icon`，**不支持**改版本元数据。要改 `ProductName`/`CompanyName` 等必须用**完整版 rcedit v5.0.2**（`rcedit` npm 包，带 `--set-version-string`），已下载到 `node_modules/electron-winstaller/vendor/rcedit-full/package/bin/rcedit-x64.exe`。若本机还没有 `rcedit-full/`，先下载 `rcedit@5.0.2` 的 tarball 解包：

```powershell
& $NODE22 -e "(async()=>{const r=await fetch('https://registry.npmjs.org/rcedit/-/rcedit-5.0.2.tgz');const b=Buffer.from(await r.arrayBuffer());require('fs').writeFileSync('E:/AFFiNE/AFFiNE/node_modules/electron-winstaller/vendor/rcedit-full/rcedit-5.0.2.tgz',b)})()"
tar -xzf node_modules/electron-winstaller/vendor/rcedit-full/rcedit-5.0.2.tgz -C node_modules/electron-winstaller/vendor/rcedit-full
```

```powershell
cd $ELECTRON_DIR
$exe    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\AFFiNE-canary.exe"
$ico    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\icons\icon_canary.ico"
$rcedit = "E:\AFFiNE\AFFiNE\node_modules\electron-winstaller\vendor\rcedit-full\package\bin\rcedit-x64.exe"   # 完整版

# 1) 嵌图标（完整版 rcedit 用 --set-icon）
& $rcedit $exe --set-icon $ico
# 2) 改 PE 版本信息字符串（Squirrel 快捷方式名/图标依赖这些）
& $rcedit $exe --set-version-string "CompanyName" "AFFiNE"
& $rcedit $exe --set-version-string "FileDescription" "AFFiNE-canary"
& $rcedit $exe --set-version-string "InternalName" "AFFiNE-canary"
& $rcedit $exe --set-version-string "ProductName" "AFFiNE-canary"
# 稳定版把上面四个值改成 "AFFiNE"（图标用 icon.ico）。
```

验证：嵌入后 exe 大小约 +16KB、mtime 更新；资源管理器里 exe 图标变为 AFFiNE。务必在 `createWindowsInstaller` 之前完成嵌入，否则 Setup.exe 里的 exe 仍是 Electron 图标。

生成 Setup.exe 后必须验证 nupkg 里的 stub 已嵌入图标（否则分发到其它机器后开始菜单/任务栏仍是 Electron）：

```powershell
& $NODE22 --import tsx -e '
import { execSync } from "node:child_process";
import fs from "node:fs";
const root = "E:/AFFiNE/AFFiNE/.tmp-stub-check";
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
execSync("tar -xzf out/canary/make/squirrel.windows/x64/AFFiNE-canary-0.27.5-full.nupkg -C " + JSON.stringify(root) + " lib/net45/AFFiNE-canary_ExecutionStub.exe");
const stub = fs.readFileSync(root + "/lib/net45/AFFiNE-canary_ExecutionStub.exe");
const ico = fs.readFileSync("resources/icons/icon_canary.ico");
let ok = 0;
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const e = 6 + i * 16;
  const off = ico.readUInt32LE(e + 8);
  const sz = ico.readUInt32LE(e + 12);
  const d = ico.subarray(off, off + sz).subarray(0, 16);
  console.log("image", ico[e] === 0 ? 256 : ico[e], "at", stub.indexOf(d));
  if (stub.indexOf(d) !== -1) ok++;
}
fs.rmSync(root, { recursive: true, force: true });
if (ok < ico.readUInt16LE(4)) { console.error("STUB ICON MISSING - Setup.exe will show Electron icon on fresh machines"); process.exit(1); }
console.log("OK: stub icon embedded");
'
```

或手动验证：解包 full nupkg，对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 做 ico 完整文件搜索（`indexOf` 整个 ico 文件 53568 字节，或搜 4 张图片的 `first8` 各自命中）。注意 rcedit 的 `--set-icon` 是把 ico 的**每张图**单独作为 RT_ICON 资源嵌入，不会保留完整 ico 文件；所以搜"整个 ico 文件连续字节"会漏判，必须按 ico 头解析各图片 offset/size 再逐张搜。

### 5. 生成 Squirrel 安装包

生成 Setup.exe 后**必须验证 nupkg 里的 stub 已嵌入图标**：解包 `AFFiNE-canary-0.27.5-full.nupkg`，对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 用 ico 各图片前 16 字节做 `indexOf`，4 张全命中才算通过（见坑 9 的验证方法，**不要**用 ico 完整文件或 ico 头 8 字节搜索）。

生成 Setup.exe 后**必须验证 nupkg 里的 stub 已嵌入图标**：解包 `AFFiNE-canary-0.27.5-full.nupkg`，对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 用 ico 各图片前 16 字节做 `indexOf`，4 张全命中才算通过。

本机直接跑 `make-squirrel.ts` 会在 delta 阶段失败（**坑 3**：`The base package release does not exist`，因为 out 目录里没有旧版 full nupkg 基线，`remoteReleases` 也没有配）。此时改用 `noDelta: true` 的等价调用（AGENT.md 步骤 5 已给脚本），**并手动补跑 `fix-squirrel-stub-icon.ts`**——内联脚本绕过了 `make-squirrel.ts` 的 hook：

```powershell
& $NODE22 --import tsx -e '
import("./scripts/fix-squirrel-stub-icon.ts").then(m => m.fixSquirrelStubIcon())
'
```

`make-squirrel.ts` 在 `createWindowsInstaller` 之后会自动调用 `fix-squirrel-stub-icon.ts`（见坑 9）：解包 full nupkg，用 rcedit-full 给 `lib/net45/<appName>_ExecutionStub.exe` 嵌入 app 图标 + 版本字符串，重新打包 nupkg，再 `Squirrel.exe --releasify` 重新生成 Setup.exe。手动绕过 `make-squirrel.ts`（如上面的 `--import tsx -e` 内联脚本）直接调 `createWindowsInstaller` 时，记得也要自己跑一遍 fix-squirrel-stub-icon，否则 stub 图标还是 Electron。

`make-squirrel.ts` 默认会生成 delta 包，但 delta 需要旧 full nupkg 作为基线。如果没有基线包，用 `noDelta: true` 跳过：

```powershell
cd $ELECTRON_DIR
& $NODE22 --import tsx -e '
import { createWindowsInstaller } from "electron-winstaller";
import fs from "fs-extra";
import path from "node:path";

const ROOT = process.cwd();
const appDirectory = path.resolve(ROOT, "out/canary/AFFiNE-canary-win32-x64");
const outPath = path.resolve(ROOT, "out/canary/make/squirrel.windows/x64");
const pkg = await fs.readJson(path.resolve(ROOT, "package.json"));
const appName = "AFFiNE-canary";

await fs.ensureDir(outPath);
await createWindowsInstaller({
  name: appName,
  title: appName,
  noMsi: true,
  noDelta: true,
  exe: `${appName}.exe`,
  setupExe: `${appName}-${pkg.version} Setup.exe`,
  version: pkg.version,
  appDirectory,
  outputDirectory: outPath,
  iconUrl: "https://cdn.affine.pro/app-icons/icon_canary.ico",
  setupIcon: path.resolve(ROOT, "resources/icons/icon_canary.ico"),
  loadingGif: path.resolve(ROOT, "resources/icons/affine_installing.gif"),
});

const setup = path.resolve(outPath, `${appName}-${pkg.version} Setup.exe`);
const fi = fs.statSync(setup);
console.log(`Done! Setup.exe: ${fi.size} bytes, ${fi.mtime}`);
'
```

或直接跑 `make-squirrel.ts`（有基线包时 delta 生成正常）：

```powershell
cd $ELECTRON_DIR
& $NODE22 --import tsx ./scripts/make-squirrel.ts
```

## 关键注意事项

| 项                 | 说明                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Node 版本          | 必须用 Node 22（`C:\node22\node-v22.23.3-win-x64\node.exe`），系统 Node 26 不满足 engines 约束                             |
| Yarn 调用          | 直接用 `node .yarn/releases/yarn-4.18.0.cjs`，yarn 不在 PATH                                                               |
| forge CLI          | 根目录 `node_modules/@electron-forge/cli/dist/electron-forge.js`，workspace node_modules 里找不到                          |
| forge 依赖 yarn    | forge 内部 spawn `yarn` 命令，需要创建 `yarn.cmd` shim 并加入 PATH                                                         |
| forge package 失败 | Windows 上 forge 的 electron-packager 因 `node_modules` 软链接报 ENOENT，需手动构造打包目录                                |
| make-squirrel 依赖 | 需要 `out/canary/AFFiNE-canary-win32-x64` 完整目录（含 exe、dll、locales、resources/app）                                  |
| delta 包           | 无基线 full nupkg 时 delta 生成失败，需 `noDelta: true` 跳过                                                               |
| 构建耗时           | 全量 10-30 分钟                                                                                                            |
| Squirrel stub 图标 | stub 不继承 app 图标，开始菜单/任务栏显示 Electron；`make-squirrel.ts` 已自动调 `fix-squirrel-stub-icon.ts` 修复（见坑 9） |
| 输出目录           | `out/canary/make/squirrel.windows/x64/AFFiNE-canary-0.27.5 Setup.exe` 为最终安装包                                         |

## 验证清单

打包完成后检查：

1. `dist/main.js` 时间戳为最新
2. `out/canary/AFFiNE-canary-win32-x64/resources/app/main.js` 存在且为新构建
3. `AFFiNE-canary-0.27.5 Setup.exe` 时间戳更新
4. 运行 Setup.exe 安装后验证大纲三处修复：
   - 叶子标题（如"服务器清单"）无前置箭头
   - H4 相对 H3 缩进多 1 汉字（缩进比 H3 大而非小）
   - hover 大纲节点只有文字变亮，无底色高亮

## 常见打包坑（踩坑记录）

### 坑 1：修改了 outline 代码但 Setup.exe 没效果

**现象：** 修改了 blocksuite/affine/fragments/outline/ 下的代码，重新打包后安装运行，界面没有任何变化。

**根因：** 大纲 UI 代码在 renderer（web 前端）里，不是 Electron 主进程。只跑 build-layers.ts（主进程）不会更新 outline 代码，必须重新 bundle renderer。

**正确流程：**

1. 重新 bundle renderer（修改 outline 代码后必做）：
   cd E:\AFFiNE\AFFiNE\packages\frontend\apps\electron-renderer
   & C:\node22\node-v22.23.3-win-x64\node.exe E:\AFFiNE\AFFiNE\node_modules\@affine-tools\cli\bin\runner.js affine.ts bundle -p electron-renderer
2. 同步 renderer dist 到 electron resources：
   robocopy E:\AFFiNE\AFFiNE\packages\frontend\apps\electron-renderer\dist E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\web-static /MIR /NFL /NDL /NJH /NJS
3. 重新构造打包目录 + 生成 Setup.exe（同步骤 4/5）

**验证方法：** 打包前检查 web-static 里文件的时间戳是否为最新构建：

```powershell
Get-ChildItem E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\web-static -Recurse -File | Sort LastWriteTime -Descending | Select -First 3 Name,LastWriteTime
```

如果时间戳早于代码修改时间，说明 renderer 没有重新构建。

### 坑 2：forge package 在 Windows 上静默失败

**现象：** electron-forge package 日志显示 Finalizing package 成功，但 out/canary/AFFiNE-canary-win32-x64 目录没有生成。

**根因：** forge 内部调用 electron-packager 复制 node_modules，Windows 上软链接/符号链接导致 ENOENT: no such file or directory, stat ...\resources\app\node_modules，但错误被吞掉。

**归因澄清（重要，别搞混）：**

- 这个 ENOENT 是 **Windows 文件系统特性**导致的，**与 Node.js 版本无关**。Yarn 4 用 `nodeLinker: node-modules` + `nmMode: hardlinks-local`，monorepo 依赖靠 junction（目录符号链接）连接；Windows 上 electron-packager 在 Finalizing 阶段 `stat` 临时目录里尚未落地的 `resources\app\node_modules` 链接目标就报 ENOENT。换 Node 22 还是 Node 26 都会挂。
- 与它正交的另一条线才是 Node 版本问题：仓库 `engines` 约束 `>=22.12.0 <23.0.0`，系统默认 v26 不满足，导致 `build-layers.ts` / rspack / tsx 构建脚本在 v26 下报错，必须用 Node 22。
- 即：forge 失败 = Windows 软链接问题（非 Node 版本）；必须 Node 22 = 构建脚本 engines 约束。两件事别混为一谈。

**绕过方法：** 不用 forge package，手动构造打包目录（见步骤 4），然后直接跑 make-squirrel。

### 坑 3：make-squirrel delta 包报错

**现象：** make-squirrel.ts 运行后，AFFiNE-canary-0.27.5 Setup.exe 没有更新（时间戳是旧的），日志报 DeltaPackageBuilder.CreateDeltaPackage 错误。

**根因：** Squirrel 生成 delta nupkg 需要旧的 full nupkg 作为基线。如果没有基线包（比如 .tmp-full.nupkg 被删了），delta 生成失败，createWindowsInstaller 抛异常，Setup.exe 不会重新生成。

**绕过方法：** 用 noDelta: true 跳过 delta 生成：

```javascript
await createWindowsInstaller({
  noMsi: true,
  noDelta: true,  // 关键：跳过 delta 包
  ...
});
```

### 坑 4：安装后运行的是 %LOCALAPPDATA%\\apps 目录，不是 System32

**现象：** 安装后运行 AFFiNE，界面没有最新修改。

**根因：** Squirrel 安装器把应用装到 %LOCALAPPDATA%\apps\AFFiNE-canary\ 目录，System32 下的 exe 只是快捷 shim。实际运行的是 LOCALAPPDATA 里的版本。

**验证方法：**

```powershell
Get-Item "$env:LOCALAPPDATA\apps\AFFiNE-canary\AFFiNE-canary.exe" | Select Name,LastWriteTime
```

### 坑 5：yarn 不在 PATH

**现象：** electron-forge package 报 spawn yarn ENOENT。

**根因：** 仓库用 yarn 4 workspaces，但系统 PATH 里没有 yarn。

**绕过方法：** 创建 yarn.cmd shim 并加入 PATH：

```powershell
$tmpBin = "E:\AFFiNE\AFFiNE\.tmp-bin"
New-Item -ItemType Directory -Path $tmpBin -Force | Out-Null
$cmdContent = "@echo off`r`nC:\node22\node-v22.23.3-win-x64\node.exe `"E:\AFFiNE\AFFiNE\.yarn\releases\yarn-4.18.0.cjs`" %*"
[System.IO.File]::WriteAllText("$tmpBin\yarn.cmd", $cmdContent)
$env:PATH = "$tmpBin;" + $env:PATH
```

### 坑 6：outline 缩进 CSS 的级联问题

**现象：** 修改了 subtypeStyles 的 paddingLeft，但实际渲染的缩进和预期不符。

**根因：** outline-preview.css.ts 里 textGeneral 和 subtypeStyles 都设置了 paddingLeft，vanilla-extract 生成的 CSS 类顺序决定了谁覆盖谁。如果 textGeneral 在 CSS 文件里定义在 subtypeStyles 之后，textGeneral 的 paddingLeft 会覆盖 heading 的。

**当前设计（2026-09-25 定稿）：**

- textGeneral 不再设 paddingLeft（已删除）
- 带箭头节点：paddingLeft = 级数 × 1.2em，箭头在行首（0 偏移），文字在 paddingLeft 处
  - H1 箭头节点：文字 1.2em；H2 箭头节点：文字 2.4em；H3 箭头节点：文字 3.6em；H4 箭头节点：文字 4.8em
- 叶子节点：无箭头，paddingLeft = (级数+1) × 1.2em，即文字位置 = 父级箭头节点文字位置 + 1.2em
  - 例：H5 叶子（新增节点）：新 字 6.0em = H4 箭头节点测 字位置（4.8em）+ 1.2em
- 效果：H1 紧贴左侧（0 偏移），每级相对父级缩进 1 个汉字宽度（1.2em）
- 踩过的坑：叶子节点 paddingLeft 曾误设为 级数×1.2em（和箭头节点相同），导致叶子比父级还少缩进

**关键文件：**

- blocksuite/affine/fragments/outline/src/card/outline-preview.css.ts — subtypeStyles 的 paddingLeft 值
- blocksuite/affine/fragments/outline/src/card/outline-preview.ts — 箭头按钮渲染逻辑（_renderToggle）
- blocksuite/affine/fragments/outline/src/card/outline-card.css.ts — toggle 按钮宽度（1.2em）

### 坑 7：exe 图标需 rcedit 手动嵌入，否则显示 Electron 默认图标

**现象：** 手动打包出的 `AFFiNE-canary.exe` 在资源管理器/任务栏里显示的是 Electron 官方图标（GitHub），不是 AFFiNE。

**根因：** Windows 的 exe 图标内嵌在 PE 资源段。官方 `forge make` 经 electron-packager（底层用 `@electron/rcedit`）把 `packagerConfig.icon`（`resources/icons/icon_canary.ico`）编译进 exe；我们绕开 forge 手动 `Copy-Item electron.exe` 时跳过了这步，exe 沿用 Electron 自带图标。验证：手动打包的 exe 与 `node_modules/electron/dist/electron.exe` 大小、时间戳一致，且 `VersionInfo` 显示 `ProductName=Electron`、`InternalName=electron.exe`。

**修复：在步骤 5 生成 Squirrel 安装包之前，用 rcedit 把 ico 嵌入到已打包的 exe**

```powershell
# 项目未直接依赖 @electron/rcedit，但 electron-winstaller 自带 rcedit.exe
$exe    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\out\canary\AFFiNE-canary-win32-x64\AFFiNE-canary.exe"
$ico    = "E:\AFFiNE\AFFiNE\packages\frontend\apps\electron\resources\icons\icon_canary.ico"
$rcedit = "E:\AFFiNE\AFFiNE\node_modules\electron-winstaller\vendor\rcedit.exe"
# 用完整版 rcedit（见步骤 4.5，rcedit-full/package/bin/rcedit-x64.exe）
& $rcedit $exe --set-icon $ico
& $rcedit $exe --set-version-string "CompanyName" "AFFiNE"
& $rcedit $exe --set-version-string "FileDescription" "AFFiNE-canary"
& $rcedit $exe --set-version-string "InternalName" "AFFiNE-canary"
& $rcedit $exe --set-version-string "ProductName" "AFFiNE-canary"
```

**验证：** rcedit 成功后 exe 大小会增大（约 +16KB），mtime 更新；但 `VersionInfo`（CompanyName/FileDescription）仍显示 Electron——这是正常的，rcedit 只改图标资源，不改 version info。真正生效的是 exe 的内嵌图标资源，资源管理器会显示 AFFiNE。务必在 `createWindowsInstaller` 之前完成嵌入，否则 Setup.exe 里的 exe 仍是 Electron 图标。

### 坑 8：手动打包需注入 productName + 复制 icons，否则标题/图标是 Electron

**现象：** 运行后窗口标题显示 `@affine/electron`（不是 `AFFiNE-canary`），任务栏图标仍是 Electron 默认。

**根因：** 这两条都源于手动打包目录 `resources/app/` 不完整：

- **标题**：主窗口（`createMainWindow`）未显式设 `title`，Electron 回退到 `app.name` = 打包目录 `resources/app/package.json` 的 `productName ?? name`。官方 forge 的 `readPackageJson` hook 会注入 `productName`（canary=`AFFiNE-canary`，stable=`AFFiNE`）；手动 `Copy-Item` 跳过了注入，`name=@affine/electron`、`productName=undefined`，标题就成了 `@affine/electron`。
- **图标**：主进程托盘/窗口图标走 `resources/app/resources/icons/*`（`nativeImage.createFromPath(icons.tray)` 等）。手动打包若只复制了 `web-static`、没复制 `icons/`，这些路径解析不到，图标回退默认。

**修复（已并入步骤 4 标准流程）：**

- 打包后给 `resources/app/package.json` 注入 `productName`（canary=`AFFiNE-canary`，stable=`AFFiNE`），`app.name` 正确后标题即显示应用名。
- `robocopy resources/icons → resources/app/resources/icons`，补齐托盘/窗口图标素材。
- 重跑 rcedit（坑 7）嵌入 exe 图标后，**重装** Squirrel（`%LOCALAPPDATA%\apps\AFFiNE-canary` 那份 exe 才会带上图标），任务栏图标才更新——光改 `out/` 里的 exe 不重装，任务栏不变。

### 坑 9：Squirrel 执行桩（ExecutionStub）不继承 app 图标，开始菜单/任务栏显示 Electron 图标

**现象：** 安装包（Setup.exe）里的主 exe（约 210MB）图标正确，但从开始菜单启动时任务栏/开始菜单里仍是 Electron 默认图标。安装后自动启动正常，从开始菜单启动才暴露问题。

**根因：** electron-winstaller 生成的 Squirrel 执行桩 `lib/net45/<appName>_ExecutionStub.exe`（约 309KB）**不嵌入 app 图标**。Squirrel 首次安装时把该桩部署到 `%LOCALAPPDATA%/<app>/<app>.exe`（本机为 `C:\Users\xqyi\AppData\Local\AFFiNE-canary\AFFiNE-canary.exe`），开始菜单/任务栏快捷方式（`.lnk` 的 `IconLocation`）指向的就是这个桩，而非 resources/app 里的完整 exe。桩没有图标 → Windows 回退到 Electron 默认图标。任意新机器安装后都会复现。

**修复（已自动 hook，commit 7fde30251）：** 新增 `packages/frontend/apps/electron/scripts/fix-squirrel-stub-icon.ts`，在 `make-squirrel.ts` 的 `createWindowsInstaller` 之后自动执行：解包 full nupkg → 对 `lib/net45/<appName>_ExecutionStub.exe` 跑 `rcedit-full`（`--set-icon` 嵌 `resources/icons/icon_canary.ico` + 4 个 version-string）→ 重新打包 nupkg → `Squirrel.exe --releasify --setupIcon <ico> --no-msi --no-delta` 重新生成 Setup.exe。

**验证方法：** 解包 Setup.exe 附带的 nupkg，对桩 exe 做二进制搜索 ico 文件头 8 字节（`00 00 01 00 00 01 ...`），命中即成功（本机 offset ≈ 297908）。**不要看 exe 大小判断**——rcedit `--set-icon` 是替换资源段，stub 已有 `.rsrc` 段时总大小不变（309248）。另注意 rcedit 要用完整版 `rcedit-full`（精简版 `vendor/rcedit.exe` 不支持 `--set-icon` 之外的能力，见步骤 4.5）。

**本机手动验证快捷方式：** 若只想在本机立刻看到效果（不重装），用 WScript.Shell 把 `C:\Users\xqyi\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\AFFiNE\AFFiNE-canary.lnk` 的 `IconLocation` 改为主 exe 路径 `C:\Users\xqyi\AppData\Local\AFFiNE-canary\App-<版本>\AFFiNE-canary.exe,0`——仅对本机有效，跨机器必须靠修复后的桩。

## 构建/打包注意事项（务必遵守，踩过坑）

### 必须用 Node 22 编译

- 本机默认 node 是 v26，会直接让 `build-layers.ts` / tsx 报错，**不要用默认 node**
- 所有构建/打包/测试命令一律走 Node 22 绝对路径：`& "C:\node22\node-v22.23.3-win-x64\node.exe"`，并先确认 `$PSVersionTable`/`node --version` 是 22
- 例：`& "C:\node22\node-v22.23.3-win-x64\node.exe" "E:\AFFiNE\AFFiNE\node_modules\vitest\vitest.mjs" run --config "<相对/绝对路径>"`

### lint-staged / husky 会扫到未跟踪的生成文件，提交前必须排除

- 仓库根存在大量未跟踪的构建 scratch（`.cmake/`、`.tmp-*.log`、`.tmp-bin/`、`packages/frontend/apps/electron/.tmp-*.log`、`scripts/make-env.js`、`scripts/make-nsis.mjs` 等）
- husky pre-commit 会跑 oxfmt+oxlint，一旦这些未跟踪生成文件被 lint 规则命中，提交就会失败并自动 `git stash` 回滚，反复失败很难排查
- 做法：把上述路径写入 `.git/info/exclude`（本地排除，不提交、不影响仓库 `.gitignore`），再 `git add` 目标文件提交
- `AGENT.md` 本身是 gitignored，不要强制 `git add`

### Electron 打包命令

- 打包入口：`packages/frontend/apps/electron`
- 用 Node 22 绝对路径运行 forge/make 相关脚本，产物（`Setup.exe` 等）落在该目录 build 输出里
  生成 Setup.exe 后必须验证 nupkg 里的 stub 已嵌入图标（否则分发到其它机器后开始菜单/任务栏仍是 Electron）：

```powershell
& $NODE22 --import tsx -e '
import { execSync } from "node:child_process";
import fs from "node:fs";
const root = "E:/AFFiNE/AFFiNE/.tmp-stub-check";
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
execSync("tar -xzf out/canary/make/squirrel.windows/x64/AFFiNE-canary-0.27.5-full.nupkg -C " + JSON.stringify(root) + " lib/net45/AFFiNE-canary_ExecutionStub.exe");
const stub = fs.readFileSync(root + "/lib/net45/AFFiNE-canary_ExecutionStub.exe");
const ico = fs.readFileSync("resources/icons/icon_canary.ico");
let ok = 0;
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const e = 6 + i * 16;
  const off = ico.readUInt32LE(e + 8);
  const sz = ico.readUInt32LE(e + 12);
  const d = ico.subarray(off, off + sz).subarray(0, 16);
  console.log("image", ico[e] === 0 ? 256 : ico[e], "at", stub.indexOf(d));
  if (stub.indexOf(d) !== -1) ok++;
}
fs.rmSync(root, { recursive: true, force: true });
if (ok < ico.readUInt16LE(4)) { console.error("STUB ICON MISSING - Setup.exe will show Electron icon on fresh machines"); process.exit(1); }
console.log("OK: stub icon embedded");
'
```

或手动验证：解包 full nupkg，对 `lib/net45/AFFiNE-canary_ExecutionStub.exe` 按 ico 头解析出每张图的 offset/size，取前 16 字节逐张 `indexOf`（rcedit 把 ico 拆成多张 RT_ICON 资源嵌入，完整 ico 文件或 ico 头 8 字节搜索都会漏判）。
