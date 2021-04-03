import { NovellaPreset } from './types'

const reactPreset: NovellaPreset = {
  external: ['react', 'react-dom'],
  globals: {
    react: {
      varName: 'React',
      type: 'cjs',
    },
    'react-dom': {
      varName: 'ReactDOM',
      type: 'cjs',
    },
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

const exportKey = Object.keys(Component)[0]

ReactDOM.render(
  React.createElement(
    ErrorBoundary,
    null,
    React.createElement(
      ...(novellaData?.wrapper
      ? [novellaData.wrapper, null, React.createElement(Component[exportKey], novellaData.default?.props)]
      : [Component[exportKey], novellaData.default?.props])
    )
  ),
  document.getElementById('preview')
);`
}

export default reactPreset
