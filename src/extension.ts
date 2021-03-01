import { Console } from 'console'
import * as vscode from 'vscode'
import { PreviewPanel } from './PreviewPanel'
import { getCompiler } from './webpackCompiler'

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('novella.preview', async () => {
      if (!vscode.window.activeTextEditor) {
        return
      }

      const activeDocument = vscode.window.activeTextEditor.document
      const compiler = await getCompiler(activeDocument)

      PreviewPanel.createOrShow(context.extensionUri, activeDocument, compiler)
    })
  )
}

export function deactivate() {}
