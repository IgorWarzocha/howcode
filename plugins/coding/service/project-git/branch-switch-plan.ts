export type BranchSwitchPlanInput = {
  branchName: string
  localBranches: ReadonlySet<string>
  remoteBranches: readonly string[]
}

export type BranchSwitchPlan =
  | { kind: 'local'; args: ['switch', string] }
  | { kind: 'remote'; args: ['switch', '--track', string] }
  | { kind: 'create'; args: ['switch', '--create', string] }

function chooseRemoteBranch(remoteBranches: readonly string[], branchName: string) {
  const originBranch = `origin/${branchName}`
  return remoteBranches.includes(originBranch) ? originBranch : remoteBranches[0]
}

export function createBranchSwitchPlan({
  branchName,
  localBranches,
  remoteBranches,
}: BranchSwitchPlanInput): BranchSwitchPlan {
  if (localBranches.has(branchName)) return { kind: 'local', args: ['switch', branchName] }

  const remoteBranch = chooseRemoteBranch(remoteBranches, branchName)
  if (remoteBranch) return { kind: 'remote', args: ['switch', '--track', remoteBranch] }

  return { kind: 'create', args: ['switch', '--create', branchName] }
}
