import vscode from 'vscode'
import path from 'path'
import fs from 'fs'
import { RollupWatchOptions } from 'rollup'
import { NovellaPreset } from './types'

export function getConfigs(
  preset: NovellaPreset,
  document: vscode.TextDocument
): RollupWatchOptions[] {
  const novellaDataPath =
    document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('.')) +
    '.novella.jsx'

  let hasNovella = false
  try {
    fs.statSync(novellaDataPath)
    hasNovella = true
  } catch {}

  hasNovella && console.log('Novella file was found')

  return [
    {
      input: path.resolve(document.uri.fsPath),
      external: ['react', 'react-dom'],
      output: {
        format: 'iife',
        name: 'Component',
        sourcemap: false,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
      plugins: [...preset.plugins()],
      watch: {
        skipWrite: true,
      },
    },
  ]
}
