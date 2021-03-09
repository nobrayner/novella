import * as vscode from 'vscode'
import { PreviewPanel } from './PreviewPanel'
import presetReact from './preset-react'
import { NovellaConfig } from './types'

const NOVELLA_CONFIG_URI = vscode.Uri.joinPath(
  vscode.workspace.workspaceFolders![0].uri,
  'novella.config.js'
)

async function getNovellaConfig() {
  let novellaConfig: NovellaConfig | undefined = undefined
  try {
    delete require.cache[require.resolve(NOVELLA_CONFIG_URI.fsPath)]
    novellaConfig = await import(NOVELLA_CONFIG_URI.fsPath)
  } catch (error) {}
  return novellaConfig
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('novella.preview', async () => {
      if (!vscode.window.activeTextEditor) {
        return
      }

      const config = await getNovellaConfig()
      const preset = config ? config.preset : presetReact

      const activeDocument = vscode.window.activeTextEditor.document

      await PreviewPanel.createOrShow(
        context.extensionUri,
        activeDocument,
        preset
      )
    })
  )
}

export function deactivate() {}
