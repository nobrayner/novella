import * as vscode from 'vscode'
import { PreviewPanel } from './PreviewPanel'
import presetReact from './presetReact'
import { NovellaConfig } from './types'
import * as STATE_KEYS from './globalStateKeys'

const NOVELLA_PREVIEW_SHOW_PROPS_EDITOR_CONTEXT_KEY =
  'novella.preview.props-editor'

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
  console.log('Novella has activated')

  // Set the context to match the default visibility of the props-editor
  const propsEditorVisibility = context.globalState.get<boolean | undefined>(
    STATE_KEYS.PROPS_EDITOR_VISIBLE
  )
  if (propsEditorVisibility === undefined) {
    // Defaults to visible
    context.globalState.update(STATE_KEYS.PROPS_EDITOR_VISIBLE, true)
  }
  vscode.commands.executeCommand(
    'setContext',
    NOVELLA_PREVIEW_SHOW_PROPS_EDITOR_CONTEXT_KEY,
    propsEditorVisibility ?? true // Defaults to visible
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('novella.preview.show', async () => {
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
    }),
    vscode.commands.registerCommand('novella.preview.reload', () => {
      vscode.window.showInformationMessage('Command TBD')
    }),
    vscode.commands.registerCommand('novella.preview.props-editor.hide', () => {
      vscode.commands.executeCommand(
        'setContext',
        NOVELLA_PREVIEW_SHOW_PROPS_EDITOR_CONTEXT_KEY,
        false
      )
      PreviewPanel.currentPanel?.setPropsEditorVisibility(false)
      context.globalState.update(STATE_KEYS.PROPS_EDITOR_VISIBLE, false)
    }),
    vscode.commands.registerCommand('novella.preview.props-editor.show', () => {
      vscode.commands.executeCommand(
        'setContext',
        NOVELLA_PREVIEW_SHOW_PROPS_EDITOR_CONTEXT_KEY,
        true
      )
      PreviewPanel.currentPanel?.setPropsEditorVisibility(true)
      context.globalState.update(STATE_KEYS.PROPS_EDITOR_VISIBLE, true)
    })
  )
}

export function deactivate() {}
