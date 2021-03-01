import * as vscode from 'vscode'
import path from 'path'
import {
  Compiler as WebpackCompiler,
  Stats as WebpackCompileStats,
} from 'webpack'
// import { getNonce } from "./getNonce";

export class PreviewPanel {
  // Track the currentl panel. Only allow a single panel to exist at a time.
  public static currentPanel: PreviewPanel | undefined

  public static readonly viewType = 'novella-preview'

  private readonly _panel: vscode.WebviewPanel
  private _compiler: WebpackCompiler
  private _document: vscode.TextDocument
  private _lastCompilationHash: string | undefined

  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    compiler: WebpackCompiler
  ) {
    const viewColumn = vscode.ViewColumn.Beside

    // If we already have a panel, show it.
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.trackDocument(document, compiler)
      PreviewPanel.currentPanel._panel.reveal(viewColumn)
      return
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Preview ${path.basename(document.fileName)}`,
      viewColumn,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [extensionUri],
      }
    )

    PreviewPanel.currentPanel = new PreviewPanel(
      panel,
      extensionUri,
      document,
      compiler
    )
    PreviewPanel.currentPanel.trackDocument(document, compiler)
  }

  public static kill() {
    PreviewPanel.currentPanel?.dispose()
    PreviewPanel.currentPanel = undefined
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    compiler: WebpackCompiler
  ) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._document = document
    this._compiler = compiler

    // Set the webview's initial html content
    this._update()

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      this._onDidReceiveMessage,
      null,
      this._disposables
    )
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()
    this._compiler.close(() => {
      console.log(`Stopped watching ${this._document.fileName}`)
    })

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  public trackDocument(
    document: vscode.TextDocument,
    compiler: WebpackCompiler
  ) {
    this._compiler.close(() =>
      console.log(`Stopped watching ${this._document.fileName}`)
    )

    this._document = document
    this._compiler = compiler

    this._panel.title = `Preview ${path.basename(document.fileName)}`
    this._update()

    // Start the compiler to watch for changes
    this._compiler.watch({}, this._onWebpackCompile) //this._onWebpackCompile)
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
  }

  private _onDidReceiveMessage(message: any) {
    switch (message.command) {
      case 'info':
        vscode.window.showInformationMessage(message.text)
        break
      case 'error':
        vscode.window.showErrorMessage(message.text)
    }
  }

  private _onWebpackCompile(error?: Error, result?: WebpackCompileStats) {
    if (error) {
      console.error(error)
      return
    }

    const stats = result!
    if (this._lastCompilationHash === stats.hash) {
      return
    }

    this._lastCompilationHash = stats.hash
    const info = stats.toJson()

    if (stats.hasErrors()) {
      console.error(`Compilation completed with ${info.errorsCount} errors:`)
      info.errors?.forEach((error) => {
        console.error(error.message)
      })
    } else if (stats.hasWarnings()) {
      console.warn(`Compilation completed with ${info.warningsCount} warnings:`)
      info.warnings?.forEach((warning) => {
        console.warn(warning.message)
      })
    } else {
      if (PreviewPanel.currentPanel) {
        const componentCode = PreviewPanel.currentPanel?._compiler.outputFileSystem
          // @ts-ignore
          .readFileSync('/dist/component.js')
          .toString()

        PreviewPanel.currentPanel._panel.webview.html = PreviewPanel.currentPanel._getHtmlForWebview(
          PreviewPanel.currentPanel._panel.webview,
          componentCode
        )
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, componentCode?: string) {
    const reactUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'node_modules/react/umd',
        'react.development.js'
      )
    )
    const reactDomUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'node_modules/react-dom/umd',
        'react-dom.development.js'
      )
    )

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
  <script>
    // (function () {
    //   const vscode = acquireVsCodeApi()
    //   vscode.postMessage({
    //     command: 'info',
    //     text: 'A message from the extension!'
    //   })
    // }())
  </script>
  <script src="${reactUri}"></script>
  <script src="${reactDomUri}"></script>
  ${
    componentCode
      ? `<script>
      ${componentCode}
      ReactDOM.render(React.createElement(Component.default, null), document.getElementById('root'))
    </script>`
      : ''
  }
</body>
</html>`
  }
}
