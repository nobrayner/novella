/* eslint-disable @typescript-eslint/naming-convention */
import vscode from 'vscode'
import path from 'path'
import fs from 'fs'
import { RollupWatchOptions } from 'rollup'
import { PreviewOptions } from './types'

import alias from '@rollup/plugin-alias'
import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
// @ts-ignore
import image from '@rollup/plugin-image'
import json from '@rollup/plugin-json'
import postcss from 'rollup-plugin-postcss'

export function getConfigs(
  options: PreviewOptions,
  document: vscode.TextDocument
): RollupWatchOptions[] {
  const configs: RollupWatchOptions[] = [
    {
      input: path.resolve(document.uri.fsPath),
      external: [
        ...(options.preset.externals ?? []),
        ...(options.augment?.externals ?? []),
      ],
      plugins: [
        alias({
          entries: Object.entries(options.aliases ?? {}).reduce<{
            [find: string]: string
          }>((accume, [aliasKey, aliasPath]) => {
            accume[aliasKey] = aliasPath.replace(
              /<rootDir>/,
              path.resolve(vscode.workspace.workspaceFolders![0].uri.fsPath)
            )

            return accume
          }, {}),
        }),
        replace({
          preventAssignment: true,
          values: {
            'process.env.NODE_ENV': JSON.stringify('production'),
          },
        }),
        commonjs({
          include: [/node_modules/],
        }),
        image(),
        json(),
        postcss({
          modules: true,
          autoModules: true,
          use: ['sass', 'less', 'stylus'],
        }),
        ...(options.augment?.plugins ?? []),
        ...options.preset.plugins,
      ],
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
      external: [
        ...(options.preset.externals ?? []),
        ...(options.augment?.externals ?? []),
      ],
      plugins: [...(options.augment?.plugins ?? []), ...options.preset.plugins],
      watch: {
        skipWrite: true,
      },
    })
  } catch {}

  return configs
}
