import * as vscode from 'vscode'
import path from 'path'
import * as bundler from './bundler'
import { PreviewOptions, WebviewUpdate, WebviewUpdateData } from './types'

export class PreviewPanel {
  // Track the current panel. Only allow a single panel to exist at a time.
  public static currentPanel: PreviewPanel | undefined

  public static readonly viewType = 'novellaPreview'

  private readonly _panel: vscode.WebviewPanel
  private _lastUpdateData: WebviewUpdateData | undefined

  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static async createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    options: PreviewOptions
  ) {
    const previewColumn = vscode.ViewColumn.Beside

    if (PreviewPanel.currentPanel) {
      await PreviewPanel.currentPanel.trackDocument(document, options)
      PreviewPanel.currentPanel._panel.reveal(previewColumn)

      return
    }

    const currentViewColumn = vscode.window.activeTextEditor?.viewColumn ?? 1

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Preview ${path.basename(document.fileName)}`,
      previewColumn,
      {
        enableScripts: true,
      }
    )

    PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri)
    await PreviewPanel.currentPanel.trackDocument(document, options)
  }

  public static kill() {
    PreviewPanel.currentPanel?.dispose()
    PreviewPanel.currentPanel = undefined
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._panel.webview.onDidReceiveMessage(this._receiveMessage)
    this._update()
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined

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

  private _receiveMessage(payload: { type: 'error'; message: string }) {
    switch (payload.type) {
      case 'error':
        vscode.window.showErrorMessage(payload.message)
        break
      default:
        vscode.window.showInformationMessage(
          'Unknown message: ' + JSON.stringify(payload)
        )
    }
  }

  private _update(update?: WebviewUpdate) {
    const updateData = {
      ...this._lastUpdateData,
      ...update?.data,
    }

    this._panel.webview.html = this._getHtmlForWebview(
      this._panel.webview,
      update?.options,
      updateData
    )

    this._lastUpdateData = updateData
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    options?: PreviewOptions,
    updateData?: WebviewUpdateData
  ) {
    const workspaceUri = vscode.workspace.workspaceFolders![0].uri

    const mainCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'assets', 'main.css')
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
  <link rel="stylesheet" href="${mainCssUri}">
  ${
    hasStylesheets
      ? stylesheets.map(
          (stylesheetPath) =>
            `<link rel="stylesheet" href="${webview.asWebviewUri(
              vscode.Uri.joinPath(
                workspaceUri,
                stylesheetPath.replace(/<rootDir>/, '')
              )
            )}">`
        )
      : ''
  }
  ${updateData?.css ? `<style>\n${updateData.css}</style>` : ''}
</head>
<body>
  <script>
    (() => {
      document.querySelector('#_defaultStyles').remove()
      const vscode = acquireVsCodeApi()
      
      window.onerror = function (msg, url, line) {
        vscode.postMessage({
          type: 'error',
          message: msg,
        })
      }
    })()
    delete globalThis.acquireVsCodeApi
  </script>
  <div id="preview"></div>
  <div id="props-editor">
    <textarea oninput="debouncedRerender(event)"></textarea>
    <div class="resize-bar"></div>
  </div>
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
    const TAG_MAP = {
      function: (value) => (() => value),
      date: (value) => new Date(value),
    }
    function prepareProps(props) {
      if (props) {
        const newProps = {};

        Object.entries(props).forEach(([k, v]) => {
          const splitKey = k.split('::');
          if (splitKey[1]) {
            newProps[splitKey[0]] = TAG_MAP[splitKey[1]](v);
          } else {
            newProps[k] = v;
          }
        })

        return newProps;
      }

      return undefined;
    }

    /*
     * COMPONENT
     */
    ${updateData?.component ?? 'const Component = { default: () => null };'}
    ${updateData?.novellaData ?? 'const novellaData = { default: null };'}

    ${
      options?.preset.render
        ? `${options?.preset.render.toString()};
    
    const componentKey = Object.keys(Component)[0];

    render(
      Component[componentKey],
      prepareProps(novellaData.default?.props),
      novellaData.default?.wrapper
    );
    
    function debounce(func, timeout = 300){
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
      };
    }
    const debouncedRerender = debounce((event) => {
      try {
        const props = prepareProps(JSON.parse(event.target.value))
        render(
          Component[componentKey],
          props,
          novellaData.default?.wrapper
        );
      } catch(error) {
        render(
          ${updateData?.errorComponent?.toString()},
          { errorMessage: error.toString() },
          null,
        )
      }
    })
    
    /*
     * PROPS EDITOR
     */
    document.querySelector('#props-editor>textarea').innerHTML = JSON.stringify(novellaData.default?.props, null, 2) ?? '';
    function boxResizer(selector) {
      const box = document.querySelector(selector);
      const resizeBar = box.querySelector(".resize-bar");

      resizeBar.addEventListener("mousedown", (e) => {
        window.addEventListener("mousemove", doResize);
        window.addEventListener("mouseup", () =>
          window.removeEventListener("mousemove", doResize)
        );
      });

      function doResize(e) {
        const rect = box.getBoundingClientRect();
        box.style.width = rect.width - (e.pageX - rect.left) + "px";
      }
    }
    boxResizer("#props-editor");`
        : ''
    };
  </script>
</body>
</html>`
  }
}
