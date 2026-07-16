const pathSegmentSeparatorPattern = /[\\/]/

export function getSidebarFolderProjectName(projectPath: string) {
  return projectPath.split(pathSegmentSeparatorPattern).filter(Boolean).pop() ?? projectPath
}
