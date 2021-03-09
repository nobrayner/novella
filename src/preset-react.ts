import { NovellaPreset } from './types'

// @ts-ignore
import sucrase from '@rollup/plugin-sucrase'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
// @ts-ignore
import image from '@rollup/plugin-image'
import postcss from 'rollup-plugin-postcss'

import { Plugin } from 'rollup'

function plugins(): Plugin[] {
  return [
    postcss({
      extensions: ['.css'],
    }),
    image(),
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
  return `ReactDOM.render(
  React.createElement(
    ...(novellaData?.wrapper
    ? [novellaData.wrapper, null, React.createElement(Component, novellaData?.props)]
    : [Component, novellaData?.props])
  ),
  document.getElementById('preview')
);`
}

const reactPreset: NovellaPreset = {
  plugins,
  externals,
  globals,
  scripts,
  render,
}

export default reactPreset
