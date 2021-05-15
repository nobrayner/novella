import * as vscode from 'vscode'
import { PreviewPanel } from './PreviewPanel'
import presetReact from './presetReact'
import { NovellaConfig } from './types'

const NOVELLA_CONFIG_URI = vscode.Uri.joinPath(
  vscode.workspace.workspaceFolders![0].uri,
  'novella.config.js'
)

async function getNovellaConfig(): Promise<NovellaConfig | undefined> {
  let novellaConfig: NovellaConfig | undefined = undefined

  try {
    delete require.cache[require.resolve(NOVELLA_CONFIG_URI.fsPath)]
    novellaConfig = await import(require.resolve(NOVELLA_CONFIG_URI.fsPath))
  } catch (error) {
    // console.warn(error)
  }

  return novellaConfig
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('novella.preview', async () => {
      if (!vscode.window.activeTextEditor) {
        return
      }

      const config = await getNovellaConfig()
      const preset = presetReact

      const activeDocument = vscode.window.activeTextEditor.document

      await PreviewPanel.createOrShow(
        context.extensionUri,
        context.globalState,
        activeDocument,
        {
          preset,
          ...config,
        }
      )
    })
  )
}

export function deactivate() {}
