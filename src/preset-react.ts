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

function externals() {
  return ['react', 'react-dom']
}

function globals() {
  return {
    react: 'React',
    'react-dom': 'ReactDOM',
  }
}

function scripts() {
  return [
    'react/umd/react.development.js',
    'react-dom/umd/react-dom.development.js',
  ]
}

function render() {
  return `ReactDOM.render(React.createElement(Component, null), document.getElementById('preview'));`
}

const reactPreset: NovellaPreset = {
  plugins,
  externals,
  globals,
  scripts,
  render,
}

export default reactPreset
