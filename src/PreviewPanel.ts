import * as vscode from 'vscode'
import path from 'path'
import * as rollup from 'rollup'
import { getConfigs } from './bundler'
import { NovellaPreset } from './types'

export class PreviewPanel {
  // Track the current panel. Only allow a single panel to exist at a time.
  public static currentPanel: PreviewPanel | undefined

  public static readonly viewType = 'novella-preview'

  private readonly _panel: vscode.WebviewPanel
  private _document: vscode.TextDocument
  private _preset: NovellaPreset
  private _watcher: rollup.RollupWatcher | undefined
  private _lastCompilationHash: string | undefined

  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static async createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    preset: NovellaPreset
  ) {
    const previewColumn = vscode.ViewColumn.Beside

    // If we already have a panel, show it.
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.trackDocument(document, preset)
      PreviewPanel.currentPanel._panel.reveal(previewColumn)
      return
    }

    const currentViewColumn = vscode.window.activeTextEditor?.viewColumn ?? 1

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Preview ${path.basename(document.fileName)}`,
      previewColumn,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders![0].uri,
            'node_modules'
          ),
          vscode.Uri.joinPath(extensionUri, 'assets'),
        ],
      }
    )

    // Open the novella config file (if it exists)
    const novellaDataFile = path.resolve(
      document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('.')) +
        '.novella.js'
    )
    try {
      const doc = await vscode.workspace.openTextDocument(novellaDataFile)
      await vscode.commands.executeCommand('workbench.action.splitEditorDown')
      await vscode.window.showTextDocument(doc, currentViewColumn + 2)
    } catch {}

    PreviewPanel.currentPanel = new PreviewPanel(
      panel,
      extensionUri,
      document,
      preset
    )
  }

  public static kill() {
    PreviewPanel.currentPanel?.dispose()
    PreviewPanel.currentPanel = undefined
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    preset: NovellaPreset
  ) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._document = document
    this._preset = preset

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    this.trackDocument(document, preset)
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()
    this._watcher?.close()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  public trackDocument(document: vscode.TextDocument, preset: NovellaPreset) {
    // Stop watching any existing components
    this._watcher?.close()

    this._document = document
    this._preset = preset

    this._watcher = rollup.watch(getConfigs(preset, document))
    this._watcher.on('event', this._onWatchEvent.bind(this))

    this._panel.title = `Preview ${path.basename(document.fileName)}`
    this._update()
  }

  private async _onWatchEvent(event: rollup.RollupWatcherEvent) {
    switch (event.code) {
      case 'ERROR':
        vscode.window.showErrorMessage(event.error.message)
        event.result?.close()
        break
      case 'BUNDLE_END':
        const { output } = await event.result.generate({
          name: 'Component',
          format: 'iife',
          globals: this._preset.globals(),
        })
        event.result.close()

        let allChunkCode = ''
        for (const chunkOrAsset of output) {
          if (chunkOrAsset.type === 'asset') {
            console.log('Asset', chunkOrAsset.fileName)
          } else {
            allChunkCode += chunkOrAsset.code
          }
        }

        this._panel.webview.html = this._getHtmlForWebview(
          this._panel.webview,
          allChunkCode
        )

        break
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
  }

  private _getHtmlForWebview(webview: vscode.Webview, componentCode?: string) {
    const workspaceUri = vscode.workspace.workspaceFolders![0].uri

    const reactUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        workspaceUri,
        'node_modules/react/umd',
        'react.development.js'
      )
    )
    const reactDomUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        workspaceUri,
        'node_modules/react-dom/umd',
        'react-dom.development.js'
      )
    )

    const resetCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'assets', 'reset.css')
    )

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${resetCssUri}">
</head>
<body>
  <div id="preview"></div>
  <script src="${reactUri}"></script>
  <script src="${reactDomUri}"></script>
  ${
    componentCode
      ? `<script>${componentCode}</script>` + this._preset.render()
      : ''
  }
</body>
</html>`
  }
}
