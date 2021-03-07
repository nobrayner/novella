import * as vscode from 'vscode'
import { PreviewPanel } from './PreviewPanel'
import presetReact from './preset-react'

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('novella.preview', async () => {
      if (!vscode.window.activeTextEditor) {
        return
      }

      const activeDocument = vscode.window.activeTextEditor.document

      await PreviewPanel.createOrShow(
        context.extensionUri,
        activeDocument,
        presetReact
      )
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('novella.noop', () => {})
  )
}

export function deactivate() {}
