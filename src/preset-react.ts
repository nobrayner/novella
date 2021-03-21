import { NovellaPreset } from './types'

// @ts-ignore
import sucrase from '@rollup/plugin-sucrase'
import nodeResolve from '@rollup/plugin-node-resolve'

const reactPreset: NovellaPreset = {
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts', '.jsx', '.tsx'],
      browser: true,
    }),
    sucrase({
      exclude: ['node_modules/**'],
      transforms: ['jsx', 'typescript'],
    }),
  ],
  externals: ['react', 'react-dom'],
  globals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  scripts: [
    'react/umd/react.development.js',
    'react-dom/umd/react-dom.development.js',
  ],
  render,
}

function render() {
  return `class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      React.createElement(
        'code',
        {
          style: {
            color: 'var(--vscode-editorError-foreground)',
            padding: '1rem',
          }
        },
        this.state.error.toString()
      );
    }

    return this.props.children; 
  }
}

ReactDOM.render(
  React.createElement(
    ErrorBoundary,
    null,
    React.createElement(
      ...(novellaData?.wrapper
      ? [novellaData.wrapper, null, React.createElement(Component, novellaData?.props)]
      : [Component, novellaData?.props])
    )
  ),
  document.getElementById('preview')
);`
}

export default reactPreset
