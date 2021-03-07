import { Plugin } from 'rollup'

export type NovellaPreset = {
  plugins: () => Plugin[]
  globals: () => { [key: string]: string }
  render: () => void
}
