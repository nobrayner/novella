import * as vscode from 'vscode'
import path from 'path'
import * as bundler from './bundler'
import { PreviewOptions, WebviewUpdate } from './types'

export class PreviewPanel {
  // Track the current panel. Only allow a single panel to exist at a time.
  public static currentPanel: PreviewPanel | undefined

  public static readonly viewType = 'novellaPreview'

  private readonly _panel: vscode.WebviewPanel
  private _lastUpdate: WebviewUpdate | undefined

  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static async createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    options: PreviewOptions
  ) {
    const previewColumn = vscode.ViewColumn.Beside

    // If we already have a panel, show it.
    if (PreviewPanel.currentPanel) {
      await PreviewPanel.currentPanel.trackDocument(document, options)
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

    PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, options)
    await PreviewPanel.currentPanel.trackDocument(document, options)
  }

  public static kill() {
    PreviewPanel.currentPanel?.dispose()
    PreviewPanel.currentPanel = undefined
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    options: PreviewOptions
  ) {
    this._panel = panel
    this._extensionUri = extensionUri

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._update()
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  public async trackDocument(
    document: vscode.TextDocument,
    options: PreviewOptions
  ) {
    await bundler.watchDocument(options, document, this._update.bind(this))

    this._panel.title = `Preview ${path.basename(document.fileName)}`
  }

  public viewColumn() {
    return this._panel.viewColumn
  }

  private _update(update?: WebviewUpdate) {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, {
      ...this._lastUpdate!,
      ...update,
    })
    this._lastUpdate = update
  }

  private _getHtmlForWebview(webview: vscode.Webview, update?: WebviewUpdate) {
    const { options, data } = update ?? {}

    const workspaceUri = vscode.workspace.workspaceFolders![0].uri

    const resetCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'assets', 'reset.css')
    )

    const stylesheets = options?.css ?? []
    const hasStylesheets = stylesheets.length > 0

    const scripts = [
      ...(options?.preset.scripts ?? []),
      ...(options?.augment?.scripts ?? []),
    ]
    const hasScripts = scripts.length > 0

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${resetCssUri}">
  ${data?.css ? `<style>\n${data.css}</style>` : ''}
  ${
    hasStylesheets
      ? stylesheets.map(
          (stylesheetPath) =>
            `<link rel="stylesheet" href="${path.resolve(
              stylesheetPath.replace(/<rootDir>/, workspaceUri.fsPath)
            )}">`
        )
      : ''
  }
</head>
<body>
  <div id="errors" style="color: var(--vscode-editorError-foreground);"></div>
  <script>
    (() => {
      // document.querySelector('#_defaultStyles').remove()
      const vscode = acquireVsCodeApi()

      const errors = document.getElementById('errors')

      window.onconsole = function (msg, url, line) {
        errors.style.padding = '1rem'
        errors.innerHTML = msg
      }
    })()
    delete globalThis.acquireVsCodeApi
  </script>
  <div id="preview"></div>
  ${
    hasScripts
      ? scripts
          .map(
            (scriptPath) =>
              `<script src=${webview.asWebviewUri(
                vscode.Uri.joinPath(workspaceUri, 'node_modules', scriptPath)
              )}></script>`
          )
          .join('\n')
      : ''
  }
  <script>
    ${data?.component ?? 'const Component = { default: () => null };'}
    ${data?.novellaData ?? 'const novellaData = { default: null }'}

    ${options?.preset.render()}
  </script>
</body>
</html>`
  }
}
