import { Plugin } from 'rollup'

export type NovellaPreset = {
  plugins: () => Plugin[]
  externals: () => string[]
  globals: () => { [key: string]: string }
  scripts: () => string[]
  render: () => void
}
