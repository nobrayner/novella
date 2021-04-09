/* eslint-disable @typescript-eslint/naming-convention */
import vscode from 'vscode'
import * as esbuild from 'esbuild'
import type { BuildOptions, BuildFailure, BuildResult } from 'esbuild'
import path from 'path'
import fs from 'fs'
import { PreviewOptions, WebviewUpdate } from './types'

import globalExternals from '@fal-works/esbuild-plugin-global-externals'
// @ts-ignore
import postCssModules from 'esbuild-plugin-postcss2'

const vscodeWorkspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath

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
    const result = await esbuild.build({
      ...getBaseBuildOptions(options, path.resolve(document.uri.fsPath)),
      globalName: 'Component',
      watch: {
        onRebuild: onRebuild(update, options),
      },
    })

    if (result.warnings.length) {
      console.log(result.warnings)
    }

    const componentBuffer = result.outputFiles!.filter(({ path }) =>
      /\.js$/i.test(path)
    )[0].contents
    const cssBuffer = result.outputFiles!.filter(({ path }) =>
      /\.css$/i.test(path)
    )[0]?.contents

    const theUpdate: WebviewUpdate = {
      options,
      data: {
        component: Buffer.from(componentBuffer).toString(),
        css: cssBuffer ? Buffer.from(cssBuffer).toString() : undefined,
      },
    }

    try {
      const novellaDataPath =
        document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('.')) +
        '.novella.jsx'
      fs.statSync(novellaDataPath)

      // Novella component-config file exists for the component, compile it and add to update
      const novellaDataResult = await esbuild.build({
        ...getBaseBuildOptions(options, path.resolve(novellaDataPath)),
        globalName: 'novellaData',
      })
      theUpdate.data.novellaData = Buffer.from(
        novellaDataResult.outputFiles![0].contents
      ).toString()
    } catch {}

    update(theUpdate)

    stopWatching = result.stop
  } catch (error) {
    vscode.window.showErrorMessage(error.message)
    console.error(error)
  }
}

function onRebuild(
  update: (update?: WebviewUpdate) => void,
  options: PreviewOptions
) {
  return (error: BuildFailure | null, buildResult: BuildResult | null) => {
    if (error) {
      vscode.window.showErrorMessage(error.message)
    } else {
      const result = buildResult!

      const componentBuffer = result.outputFiles!.filter(({ path }) =>
        /\.js$/i.test(path)
      )[0].contents
      const cssBuffer = result.outputFiles!.filter(({ path }) =>
        /\.css$/i.test(path)
      )[0]?.contents

      update({
        options,
        data: {
          component: Buffer.from(componentBuffer).toString(),
          css: cssBuffer ? Buffer.from(cssBuffer).toString() : undefined,
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
      process: JSON.stringify({
        env: {
          NODE_ENV: 'development',
        },
      }),
    },
    external: options.preset.external,
    plugins: [
      globalExternals(options.preset.globals ?? {}),
      postCssModules({
        sassOptions: {
          includePaths: [vscodeWorkspacePath],
        },
        lessOptions: {
          paths: [vscodeWorkspacePath],
        },
        stylusOptions: {
          paths: [vscodeWorkspacePath],
        },
      }),
      ...(options.preset.plugins ?? []),
      ...(options.augment?.plugins ?? []),
    ],
    loader: {
      '.png': 'dataurl',
    },
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
