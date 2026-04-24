param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DefaultRemote = 'upstream'
$DefaultMirror = 'vendor/upstream'
$FallbackBaseBranches = @('canary', 'main', 'master')

# 这个脚本是 package.json 里 yarn upstream:* 的实现层。
# 默认远端、镜像分支和基线分支候选。
function Setup-Repo {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote
  )

  # 这些本地配置能减少反复 rebase 时的手工处理。
  Log "configuring local git settings for remote `"$Remote`""
  Set-LocalConfig 'rerere.enabled' 'true'
  Set-LocalConfig 'rebase.autoStash' 'true'
  Set-LocalConfig 'merge.conflictStyle' 'zdiff3'
  Set-LocalConfig 'fetch.prune' 'true'

  if (-not (Test-RemoteExists $Remote)) {
    Warn "remote `"$Remote`" does not exist yet. Add it with:`n  git remote add $Remote <upstream-url>"
  }

  Log 'setup complete'
}

function Print-Status {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote,

    [Parameter(Mandatory = $true)]
    [string]$Mirror,

    [string]$Base
  )

  Assert-RemoteExists $Remote
  $baseBranch = Resolve-BaseBranch -Remote $Remote -ExplicitBase $Base
  $currentBranch = Get-CurrentBranchName
  $worktreeState = Get-WorktreeStatus
  $remoteRef = "$Remote/$baseBranch"

  # 优先比较本地镜像分支，其次再看远端引用。
  $comparisonRef = $null
  if (Test-GitRefExists -RefName $Mirror) {
    $comparisonRef = $Mirror
  }
  elseif (Test-GitRefExists -RefName $remoteRef) {
    $comparisonRef = $remoteRef
  }

  $mirrorDisplay = '(not available yet)'
  if (-not [string]::IsNullOrWhiteSpace($comparisonRef)) {
    $mirrorDisplay = $comparisonRef
  }

  Log "repository: $(Get-RepoRoot)"
  Log "current branch: $currentBranch"
  Log "upstream base: $Remote/$baseBranch"
  Log "mirror branch: $mirrorDisplay"
  Log "worktree: $worktreeState"

  if ([string]::IsNullOrWhiteSpace($comparisonRef)) {
    Warn "No local reference exists for $remoteRef. Run `git fetch $Remote` or `yarn upstream:sync` first."
    return
  }

  $counts = Get-RevListCounts -BaseRef $comparisonRef -HeadRef 'HEAD'
  Log "ahead/behind vs ${comparisonRef}: +$($counts.Ahead) / -$($counts.Behind)"

  if (-not (Test-GitRefExists -RefName $Mirror)) {
    Warn "mirror branch `"$Mirror`" does not exist yet. Run `yarn upstream:sync` once to create it."
  }
}

function Sync-Upstream {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote,

    [Parameter(Mandatory = $true)]
    [string]$Mirror,

    [string]$Base
  )

  Assert-RemoteExists $Remote
  $currentBranch = Get-CurrentBranchName

  if ($currentBranch -eq $Mirror) {
    throw "Refusing to rebase the mirror branch `"$Mirror`". Switch to your work branch first."
  }

  Log "fetching $Remote"
  Invoke-Git -Arguments @('fetch', '--prune', $Remote) | Out-Null

  Invoke-Git -Arguments @('remote', 'set-head', $Remote, '--auto') -AllowFailure | Out-Null

  $baseBranch = Resolve-BaseBranch -Remote $Remote -ExplicitBase $Base
  $remoteRef = "$Remote/$baseBranch"
  if (-not (Test-GitRefExists -RefName $remoteRef)) {
    throw "Remote branch `"$remoteRef`" was not found after fetch."
  }

  # 先把上游拉下来，再更新本地镜像分支。
  Log "updating mirror branch $Mirror -> $remoteRef"
  Invoke-Git -Arguments @('branch', '--force', '--no-track', $Mirror, $remoteRef) | Out-Null

  # 留一个回滚点，出问题时可以快速回到同步前状态。
  $backupRef = New-BackupRef -BranchName $currentBranch
  Log "saving rollback ref at $backupRef"
  Invoke-Git -Arguments @('update-ref', $backupRef, 'HEAD') | Out-Null

  Log "rebasing $currentBranch onto $Mirror"
  $rebaseResult = Invoke-Git -Arguments @('rebase', '--autostash', $Mirror) -Capture -AllowFailure

  if (-not [string]::IsNullOrWhiteSpace($rebaseResult.Output)) {
    Write-Host $rebaseResult.Output
  }

  if ($rebaseResult.Status -ne 0) {
    Warn 'rebase stopped before completion. Resolve conflicts, then run `git rebase --continue` or `git rebase --abort`.'
    Warn "rollback ref: $backupRef"
    exit $rebaseResult.Status
  }

  Log 'sync complete'
  Log "rollback ref kept at $backupRef"
}

function Parse-Options {
  param(
    [string[]]$Args
  )

  # 支持 --remote、--mirror、--base 以及对应的 = 形式参数。
  $options = [ordered]@{
    Remote = $null
    Mirror = $null
    Base = $null
  }

  for ($index = 0; $index -lt $Args.Count; $index += 1) {
    $arg = $Args[$index]

    if ($arg -eq '--help' -or $arg -eq '-h') {
      continue
    }

    if ($arg -eq '--remote') {
      $index += 1
      $options.Remote = Require-Value -Args $Args -Index $index -Flag '--remote'
      continue
    }
    if ($arg.StartsWith('--remote=')) {
      $options.Remote = $arg.Substring('--remote='.Length)
      continue
    }

    if ($arg -eq '--mirror') {
      $index += 1
      $options.Mirror = Require-Value -Args $Args -Index $index -Flag '--mirror'
      continue
    }
    if ($arg.StartsWith('--mirror=')) {
      $options.Mirror = $arg.Substring('--mirror='.Length)
      continue
    }

    if ($arg -eq '--base') {
      $index += 1
      $options.Base = Require-Value -Args $Args -Index $index -Flag '--base'
      continue
    }
    if ($arg.StartsWith('--base=')) {
      $options.Base = $arg.Substring('--base='.Length)
      continue
    }

    throw "Unknown option: $arg"
  }

  return [pscustomobject]$options
}

function Resolve-BaseBranch {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote,

    [string]$ExplicitBase
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitBase)) {
    return $ExplicitBase
  }

  # 先读远端 HEAD，再按常见分支名兜底。
  $remoteHead = (Invoke-Git -Arguments @('symbolic-ref', '--quiet', '--short', "refs/remotes/$Remote/HEAD") -Capture -AllowFailure).Output.Trim()
  if (-not [string]::IsNullOrWhiteSpace($remoteHead)) {
    return $remoteHead.Substring($Remote.Length + 1)
  }

  foreach ($candidate in $FallbackBaseBranches) {
    if (Test-GitRefExists -RefName "$Remote/$candidate") {
      return $candidate
    }
  }

  if (Test-RemoteExists $Remote) {
    return $FallbackBaseBranches[0]
  }

  throw "Unable to determine the default branch for remote `"$Remote`". Pass --base <branch> explicitly."
}

function Ensure-InsideGitRepository {
  $result = Invoke-Git -Arguments @('rev-parse', '--show-toplevel') -Capture -AllowFailure
  if ($result.Status -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) {
    throw 'This command must be run inside a git repository.'
  }
}

function Get-RepoRoot {
  return (Invoke-Git -Arguments @('rev-parse', '--show-toplevel') -Capture).Output.Trim()
}

function Get-CurrentBranchName {
  $branch = (Invoke-Git -Arguments @('branch', '--show-current') -Capture).Output.Trim()
  if ([string]::IsNullOrWhiteSpace($branch)) {
    throw 'Detached HEAD is not supported. Switch to a branch first.'
  }

  return $branch
}

function Get-WorktreeStatus {
  # 把工作区状态压缩成一条摘要，方便 status 输出。
  $status = (Invoke-Git -Arguments @('status', '--porcelain=v1') -Capture).Output.Trim()
  if ([string]::IsNullOrWhiteSpace($status)) {
    return 'clean'
  }

  $tracked = 0
  $untracked = 0
  foreach ($line in ($status -split "`r?`n")) {
    if ($line.StartsWith('??')) {
      $untracked += 1
    } else {
      $tracked += 1
    }
  }

  return "dirty ($tracked tracked, $untracked untracked)"
}

function Test-GitRefExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RefName
  )

  return (
    (Invoke-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/heads/$RefName") -Capture -AllowFailure).Status -eq 0 -or
    (Invoke-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/remotes/$RefName") -Capture -AllowFailure).Status -eq 0
  )
}

function Test-RemoteExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote
  )

  return (Invoke-Git -Arguments @('remote', 'get-url', $Remote) -Capture -AllowFailure).Status -eq 0
}

function Assert-RemoteExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Remote
  )

  if (-not (Test-RemoteExists $Remote)) {
    throw "Remote `"$Remote`" does not exist. Add it first or pass --remote <name>."
  }
}

function Get-RevListCounts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseRef,

    [Parameter(Mandatory = $true)]
    [string]$HeadRef
  )

  $result = (Invoke-Git -Arguments @('rev-list', '--left-right', '--count', "$BaseRef...$HeadRef") -Capture).Output.Trim()
  $parts = $result -split '\s+'

  $behind = 0
  $ahead = 0
  if ($parts.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($parts[0])) {
    $behind = [int]$parts[0]
  }
  if ($parts.Count -gt 1 -and -not [string]::IsNullOrWhiteSpace($parts[1])) {
    $ahead = [int]$parts[1]
  }

  return [pscustomobject]@{
    Behind = $behind
    Ahead = $ahead
  }
}

function New-BackupRef {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BranchName
  )

  $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $branchPart = $BranchName -replace '[^A-Za-z0-9._/-]', '-'
  return "refs/backup/upstream-sync/$branchPart-$timestamp"
}

function Set-LocalConfig {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  Invoke-Git -Arguments @('config', '--local', $Key, $Value) | Out-Null
}

function Print-Help {
  @'
用法：
  yarn upstream:setup
  yarn upstream:status
  yarn upstream:sync

参数：
  --remote <name>   要使用的 Git 远端（默认：upstream）
  --mirror <ref>    本地镜像分支（默认：vendor/upstream）
  --base <branch>   远端基线分支（默认自动识别）

命令：
  setup   配置仓库，使上游同步更稳定。
  status  显示当前分支、镜像分支以及 ahead/behind 信息。
  sync    拉取上游、刷新镜像分支，并将当前分支 rebase 过去。
'@ | Write-Host
}

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [switch]$Capture,

    [switch]$AllowFailure
  )

  if ($Capture) {
    # 统一封装 git 调用，避免各处重复处理退出码和输出。
    $output = & git @Arguments 2>&1
    $status = $LASTEXITCODE
    $text = (@($output) | ForEach-Object { $_.ToString() }) -join "`n"

    if (-not $AllowFailure -and $status -ne 0) {
      throw "git $($Arguments -join ' ') failed with exit code $status`n$text"
    }

    return [pscustomobject]@{
      Status = $status
      Output = $text.TrimEnd()
    }
  }

  & git @Arguments
  $status = $LASTEXITCODE

  if (-not $AllowFailure -and $status -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $status"
  }

  return [pscustomobject]@{
    Status = $status
    Output = ''
  }
}

function Require-Value {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,

    [Parameter(Mandatory = $true)]
    [int]$Index,

    [Parameter(Mandatory = $true)]
    [string]$Flag
  )

  if ($Index -ge $Args.Count) {
    throw "Missing value for $Flag"
  }

  $value = $Args[$Index]
  if ([string]::IsNullOrWhiteSpace($value) -or $value.StartsWith('-')) {
    throw "Missing value for $Flag"
  }

  return $value
}

function Get-ValueOrDefault {
  param(
    [string]$Value,

    [Parameter(Mandatory = $true)]
    [string]$Default
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Default
  }

  return $Value
}

function Main {
  param(
    [string[]]$RemainingArgs
  )

  # 处理命令分发：help / setup / status / sync。
  $workingArgs = @()
  if ($null -ne $RemainingArgs) {
    $workingArgs = @($RemainingArgs)
  }

  $command = 'sync'
  if ($workingArgs.Count -gt 0 -and $workingArgs[0] -in @('help', 'setup', 'status', 'sync')) {
    $command = $workingArgs[0]
    $workingArgs = if ($workingArgs.Count -gt 1) {
      $workingArgs | Select-Object -Skip 1
    } else {
      @()
    }
  }

  if ($workingArgs -contains '--help' -or $workingArgs -contains '-h') {
    $command = 'help'
  }

  $options = Parse-Options -Args $workingArgs

  try {
    Ensure-InsideGitRepository

    switch ($command) {
      'help' {
        Print-Help
      }
      'setup' {
        Setup-Repo -Remote (Get-ValueOrDefault -Value $options.Remote -Default $DefaultRemote)
      }
      'status' {
        Print-Status `
          -Remote (Get-ValueOrDefault -Value $options.Remote -Default $DefaultRemote) `
          -Mirror (Get-ValueOrDefault -Value $options.Mirror -Default $DefaultMirror) `
          -Base ($options.Base)
      }
      'sync' {
        Sync-Upstream `
          -Remote (Get-ValueOrDefault -Value $options.Remote -Default $DefaultRemote) `
          -Mirror (Get-ValueOrDefault -Value $options.Mirror -Default $DefaultMirror) `
          -Base ($options.Base)
      }
      default {
        throw "Unknown command: $command"
      }
    }
  }
  catch {
    Fail $_.Exception.Message
  }
}

function Log {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "[upstream-sync] $Message"
}

function Warn {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "[upstream-sync] $Message"
}

function Fail {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "[upstream-sync] $Message"
  exit 1
}

Main -RemainingArgs $RemainingArgs

