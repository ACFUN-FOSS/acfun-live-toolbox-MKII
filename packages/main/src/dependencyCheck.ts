import { existsSync } from 'fs'
import { join } from 'path'

const workspacePackages = [
  '@app/preload',
  '@app/electron-versions'
]

export function ensureWorkspacePackagesPresent(rootDir: string): void {
  const missingPackages = workspacePackages.filter((pkgName) => {
    const packagePath = join(rootDir, 'packages', pkgName.replace('@app/', ''), 'package.json')
    return !existsSync(packagePath)
  })

  if (missingPackages.length > 0) {
    throw new Error(`Missing local workspace packages: ${missingPackages.join(', ')}`)
  }
}
