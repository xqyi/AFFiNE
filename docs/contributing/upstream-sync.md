# 上游同步流程

这个仓库最适合的维护方式，是把上游更新当作一条干净的基线分支，把你的本地修改放在一个很小、很独立的补丁栈里。

本文统一使用 `yarn upstream:*` 作为日常入口；`scripts/upstream-sync.ps1` 只是底层实现，不需要手动直跑。

## 最简流程

如果你只想记住最少的命令，可以直接按这个来：

首次先安装依赖：

```bash
yarn install
```

首次只做一次：

```bash
yarn upstream:setup
```

以后每次同步，先看状态，再同步：

```bash
yarn upstream:status
yarn upstream:sync
```

如果同步过程中出现冲突，按 git 提示处理后继续 `rebase` 即可。

## 分支职责

- `upstream` 远端：上游仓库的真实来源。
- `vendor/upstream`：由脚本维护的本地镜像分支。
- `canary` 或你的功能分支：你自己的本地修改都放这里。

不要直接往 `vendor/upstream` 提交。

## 一次性初始化

在仓库根目录先执行一次依赖安装：

```bash
yarn install
```

然后再执行：

```bash
yarn upstream:setup
```

这会开启几项有助于反复 rebase 的本地 git 配置：

- `rerere.enabled=true`
- `rebase.autoStash=true`
- `merge.conflictStyle=zdiff3`
- `fetch.prune=true`

## 日常流程

1. 每次本地改动尽量小而独立。
2. 在拉取上游更新之前，先把本地改动提交掉。
3. 先查看当前状态：

```bash
yarn upstream:status
```

4. 再同步上游：

```bash
yarn upstream:sync
```

脚本会自动执行：

- 拉取 `upstream`
- 刷新 `vendor/upstream`
- 在 `refs/backup/upstream-sync/...` 下创建一个回滚引用
- 把当前分支 rebase 到镜像分支上

## 出现冲突时

- 按 git 提示解决冲突文件。
- 用 `git rebase --continue` 继续。
- 必要时用 `git rebase --abort` 中止。

如果你想直接回到同步前的状态，使用脚本输出的回滚引用：

```bash
git reset --hard refs/backup/upstream-sync/<branch>-<timestamp>
```

## 如何让同步更轻松

- 优先用配置项和 feature flag 解决问题，尽量少改源码。
- 依赖层修复优先放在 `.yarn/patches`，不要直接 fork 包。
- 把自己的改动拆成小 commit，冲突会更容易定位。
- 不要编辑 `vendor/upstream`，把它当作只读。

## 常用检查命令

```bash
git log --oneline --left-right --cherry-pick vendor/upstream...HEAD
git diff vendor/upstream...HEAD
```

这两个命令可以直接看出，哪些 commit 和哪些代码行属于你的本地补丁栈。

