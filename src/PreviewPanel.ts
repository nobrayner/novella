import * as vscode from 'vscode'
import path from 'path'
import * as bundler from './bundler'
import { PreviewOptions, WebviewUpdate, WebviewUpdateData } from './types'
import * as STATE_KEYS from './globalStateKeys'

const NOVELLA_PREVIEW_FOCUS_CONTEXT_KEY = 'novella.preview.focus'

export class PreviewPanel {
  // Track the current panel. Only allow a single panel to exist at a time.
  public static currentPanel: PreviewPanel | undefined

  public static readonly viewType = 'novella.preview'

  private readonly _globalState: vscode.Memento

  private readonly _panel: vscode.WebviewPanel
  private _lastUpdateData: WebviewUpdateData | undefined
  private _document: vscode.TextDocument

  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static async createOrShow(
    extensionUri: vscode.Uri,
    globalState: vscode.Memento,
    document: vscode.TextDocument,
    options: PreviewOptions
  ) {
    vscode.commands.executeCommand(
      'setContext',
      NOVELLA_PREVIEW_FOCUS_CONTEXT_KEY,
      true
    )

    const previewColumn = vscode.ViewColumn.Beside

    if (PreviewPanel.currentPanel) {
      await PreviewPanel.currentPanel.trackDocument(document, options)
      PreviewPanel.currentPanel._panel.reveal(previewColumn)

      return
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      `Preview ${path.basename(document.fileName)}`,
      previewColumn,
      {
        enableScripts: true,
      }
    )

    PreviewPanel.currentPanel = new PreviewPanel(
      panel,
      extensionUri,
      globalState,
      document
    )
    await PreviewPanel.currentPanel.trackDocument(document, options)
  }

  public static kill() {
    PreviewPanel.currentPanel?.dispose()
    PreviewPanel.currentPanel = undefined
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    globalState: vscode.Memento,
    document: vscode.TextDocument
  ) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._globalState = globalState
    this._document = document

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._panel.webview.onDidReceiveMessage(this._receiveMessage.bind(this))
    this._panel.onDidChangeViewState(
      ({ webviewPanel }) => {
        vscode.commands.executeCommand(
          'setContext',
          NOVELLA_PREVIEW_FOCUS_CONTEXT_KEY,
          webviewPanel.active
        )
      },
      null,
      this._disposables
    )
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
    this._document = document

    await bundler.watchDocument(
      options,
      document,
      (initialData: WebviewUpdate) => {
        this._panel.webview.html = this._getHtmlForWebview(
          this._panel.webview,
          this._globalState,
          initialData?.options,
          initialData.data
        )
      },
      this._update.bind(this)
    )

    this._panel.title = `Preview ${path.basename(document.fileName)}`
  }

  public reload(options: PreviewOptions) {
    this.trackDocument(this._document, options)
  }

  public setPropsEditorVisibility(isVisible: boolean) {
    this._panel.webview.postMessage({
      type: 'props-editor-visibility',
      isVisible,
    })
  }

  private _receiveMessage(payload: {
    type: 'error' | 'resize-prop-editor'
    message: string
  }) {
    switch (payload.type) {
      case 'error':
        vscode.window.showErrorMessage(payload.message)
        break
      case 'resize-prop-editor':
        this._globalState.update(STATE_KEYS.PROPS_EDITOR_WIDTH, payload.message)
        break
      default:
        vscode.window.showInformationMessage(
          'Unknown message: ' + JSON.stringify(payload)
        )
    }
  }

  private _update(update: WebviewUpdate) {
    const updateData = {
      ...this._lastUpdateData,
      ...update?.data,
    }

    this._panel.webview.postMessage({
      type: 'update',
      updateData,
    })

    this._lastUpdateData = updateData
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    globalState: vscode.Memento,
    options: PreviewOptions,
    initialData: WebviewUpdateData
  ) {
    const workspaceUri = vscode.workspace.workspaceFolders![0].uri

    const mainCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'assets', 'main.css')
    )

    const stylesheets = options.css ?? []
    const hasStylesheets = stylesheets.length > 0

    const scripts = [
      ...(options.preset.scripts ?? []),
      ...(options.augment?.scripts ?? []),
    ]
    const hasScripts = scripts.length > 0

    const propsEditorWidth = globalState.get(STATE_KEYS.PROPS_EDITOR_WIDTH)
    const initialPropsEditorWidth = propsEditorWidth
      ? `width: ${propsEditorWidth};`
      : ''

    const propsEditorVisibility = globalState.get(
      STATE_KEYS.PROPS_EDITOR_VISIBLE
    )
    const initialPropsEditorVisibility = propsEditorVisibility
      ? ''
      : 'visibility: hidden;'

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
  <style id="component-styles">${initialData.css ? initialData.css : ''}</style>
</head>
<body>
  <div id="preview"></div>
  <div id="props-editor" style="${initialPropsEditorWidth} ${initialPropsEditorVisibility}">
    <textarea oninput="debouncedRerender(event)"></textarea>
    <div class="resize-bar"></div>
  </div>
  <script>
    const { updatePropsEditorSize } = (() => {
      document.querySelector('#_defaultStyles').remove();
      const vscode = acquireVsCodeApi();

      const propsEditor = document.getElementById('props-editor');
      const componentStyles = document.getElementById('component-styles');
      const propsEditorTextarea = document.querySelector('#props-editor>textarea');      

      window.addEventListener('message', (event) => {
        const payload = event.data;
        
        switch (payload.type) {
          case 'props-editor-visibility':
            propsEditor.style.visibility = payload.isVisible ? 'visible' : 'hidden';
            break;
          case 'update':
            componentStyles.innerHTML = payload.updateData.css ?? '';

            try {
              Component = eval(payload.updateData.component.replace('var Component=', ''));

              rerender(propsEditorTextarea.value);
            } catch(error) {
              render(
                ${initialData.errorComponent?.toString()},
                { errorMessage: error.toString() },
                null,
              );
            }

            break;
        }
      });

      window.onerror = function (msg, url, line) {
        vscode.postMessage({
          type: 'error',
          message: msg,
        });
      }

      const updatePropsEditorSize = (newSize) => vscode.postMessage({
        type: 'resize-prop-editor',
        message: newSize,
      });

      return {
        updatePropsEditorSize
      };
    })();
    delete globalThis.acquireVsCodeApi;
  </script>
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
    /*
     * PROPS
     */
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
            newProps[splitKey[0]] = TAG_MAP[splitKey[1].toLowerCase()](v);
          } else {
            newProps[k] = v;
          }
        })

        return newProps;
      }

      return undefined;
    }

    /*
     * HELPERS
     */
    function debounce(func, timeout = 300){
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
      };
    }

    /*
     * COMPONENT
     */
    ${initialData.component ?? 'let Component = { default: () => null };'}
    ${initialData.novellaData ?? 'const novellaData = { default: null };'}
    const componentKey = Object.keys(Component)[0];

    ${
      options.preset.render
        ? `${options.preset.render.toString()};

    render(
      Component[componentKey],
      prepareProps(novellaData.default?.props),
      novellaData.default?.wrapper
    );
    
    function rerender(jsonProps) {
      try {
        const props = jsonProps ? prepareProps(JSON.parse(jsonProps)) : null;
        render(
          Component[componentKey],
          props,
          novellaData.default?.wrapper
        );
      } catch(error) {
        render(
          ${initialData.errorComponent?.toString()},
          { errorMessage: error.toString() },
          null,
        );
      }
    }

    const debouncedRerender = debounce((event) => rerender(event.target.value));
    
    /*
     * PROPS EDITOR
     */
    const debouncedUpdatePropsEditorSize = debounce((newSize) => updatePropsEditorSize(newSize))

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
        const newSize = rect.width - (e.pageX - rect.left) + "px"
        box.style.width = newSize;
        debouncedUpdatePropsEditorSize(newSize);
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
