const pathSegmentSeparatorPattern = /[\\/]/

export function getSidebarFolderDirectoryName(directoryPath: string) {
  return directoryPath.split(pathSegmentSeparatorPattern).filter(Boolean).pop() ?? directoryPath
}
