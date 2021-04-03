/* eslint-disable @typescript-eslint/naming-convention */
import vscode from 'vscode'
import * as esbuild from 'esbuild'
import type { BuildOptions, BuildFailure, BuildResult } from 'esbuild'
import path from 'path'
import fs from 'fs'
import { PreviewOptions, WebviewUpdate } from './types'

import globalExternals from '@fal-works/esbuild-plugin-global-externals'

let stopWatching: (() => void) | undefined

export async function watchDocument(
  options: PreviewOptions,
  document: vscode.TextDocument,
  update: (update?: WebviewUpdate) => void
) {
  if (stopWatching) {
    stopWatching()
  }

  try {
    const componentResult = await esbuild.build({
      ...getBaseBuildOptions(options, path.resolve(document.uri.fsPath)),
      globalName: 'Component',
      watch: {
        onRebuild: onRebuild(update, options),
      },
    })

    console.dir(componentResult.outputFiles)

    const componentBuffer = componentResult.outputFiles!.filter(({ path }) =>
      /\.js$/i.test(path)
    )[0].contents
    const cssBuffer = componentResult.outputFiles!.filter(({ path }) =>
      /\.css$/i.test(path)
    )[0]?.contents

    const theUpdate: WebviewUpdate = {
      options,
      data: {
        component: Buffer.from(componentBuffer).toString(),
        css: cssBuffer ? Buffer.from(cssBuffer).toString() : undefined,
      },
    }
    console.dir(theUpdate)
    try {
      const novellaDataPath =
        document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('.')) +
        '.novella.jsx'
      fs.statSync(novellaDataPath)

      // A Novella exists for the component, compile it and add to update
      const novellaDataResult = await esbuild.build({
        ...getBaseBuildOptions(options, path.resolve(novellaDataPath)),
        globalName: 'novellaData',
      })
      theUpdate.data.novellaData = Buffer.from(
        novellaDataResult.outputFiles![0].contents
      ).toString()
    } catch {}

    update(theUpdate)

    stopWatching = componentResult.stop
  } catch (error) {
    vscode.window.showErrorMessage(error.message)
    console.error(error)
  }
}

function onRebuild(
  update: (update?: WebviewUpdate) => void,
  options: PreviewOptions
) {
  return (error: BuildFailure | null, result: BuildResult | null) => {
    if (error) {
      vscode.window.showErrorMessage(error.message)
    } else {
      update({
        options,
        data: {
          // If there is no error, then there is a result
          component: Buffer.from(result!.outputFiles![0].contents).toString(),
        },
      })
    }
  }
}

function getBaseBuildOptions(
  options: PreviewOptions,
  entryPoint: string
): BuildOptions {
  return {
    entryPoints: [entryPoint],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    external: options.preset.external,
    plugins: [
      globalExternals(options.preset.globals ?? {}),
      ...(options.preset.plugins ?? []),
      ...(options.augment?.plugins ?? []),
    ],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    outdir: './novella',
    absWorkingDir: path.resolve(
      vscode.workspace.workspaceFolders![0].uri.fsPath
    ),
  }
}
