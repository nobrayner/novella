import vscode from 'vscode'
import path from 'path'
import fs from 'fs'
import { RollupWatchOptions } from 'rollup'
import { NovellaPreset } from './types'

export function getConfigs(
  preset: NovellaPreset,
  document: vscode.TextDocument
): RollupWatchOptions[] {
  const configs: RollupWatchOptions[] = [
    {
      input: path.resolve(document.uri.fsPath),
      external: preset.externals(),
      plugins: preset.plugins(),
      watch: {
        skipWrite: true,
      },
    },
  ]

  const novellaDataPath =
    document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('.')) +
    '.novella.jsx'

  try {
    fs.statSync(novellaDataPath)

    // A Novella exists for the component, add it to the config list
    configs.push({
      input: path.resolve(novellaDataPath),
      external: preset.externals(),
      plugins: preset.plugins(),
      watch: {
        skipWrite: true,
      },
    })
  } catch {}

  return configs
}
