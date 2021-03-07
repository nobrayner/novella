import { NovellaPreset } from './types'

// @ts-ignore
import sucrase from '@rollup/plugin-sucrase'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'

import { Plugin } from 'rollup'

function plugins(): Plugin[] {
  return [
    postcss({
      extensions: ['.css'],
    }),
    nodeResolve({
      extensions: ['.js', '.ts', '.jsx', '.tsx'],
      browser: true,
    }),
    sucrase({
      exclude: ['node_modules/**'],
      transforms: ['jsx', 'typescript'],
    }),
    commonjs({
      include: ['node_modules/**'],
    }),
  ]
}

function globals() {
  return {
    react: 'React',
    'react-dom': 'ReactDOM',
  }
}

function render() {
  return `
<script>
  ReactDOM.render(React.createElement(Component, null), document.getElementById('preview'))
</script>
  `
}

const reactPreset: NovellaPreset = {
  plugins,
  globals,
  render,
}

export default reactPreset
