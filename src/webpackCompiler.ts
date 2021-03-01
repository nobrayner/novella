import * as vscode from 'vscode'
import path from 'path'
import webpack, { Configuration } from 'webpack'
import { createFsFromVolume, Volume } from 'memfs'

const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath
const novellaConfigUri = vscode.Uri.file(workspacePath + '/novella.config.js')

async function getConfig(
  document: vscode.TextDocument
): Promise<Configuration> {
  const config: Configuration = (await import(novellaConfigUri.path)).default

  config.output = {
    ...config.output,
    path: '/dist',
    filename: 'component.js',
    library: 'Component',
    libraryTarget: 'var',
  }
  config.optimization = {
    ...config.optimization,
    minimize: false,
  }
  config.externals = {
    react: 'React',
    'react-dom': 'ReactDOM',
  }
  config.entry = path.resolve(document.uri.fsPath)
  config.context = path.resolve(workspacePath)
  config.mode = 'production'
  if (config.module?.rules) {
    config.module.rules.forEach((rule) => {
      // @ts-ignore
      if (rule.loader === 'babel-loader') {
        // @ts-ignore
        rule.options = {
          // @ts-ignore
          ...rule.options,
          cwd: workspacePath,
        }
      }
    })
  }

  return config
}

export async function getCompiler(
  document: vscode.TextDocument
): Promise<webpack.Compiler> {
  const compiler = webpack(await getConfig(document))
  // @ts-ignore
  compiler.outputFileSystem = createFsFromVolume(new Volume())

  return compiler
}
