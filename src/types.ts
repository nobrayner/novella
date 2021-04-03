import type { Plugin } from 'esbuild'
import type { ModuleInfo } from '@fal-works/esbuild-plugin-global-externals'

export type PresetGlobals = Record<string, string | ModuleInfo>

export type NovellaPreset = {
  external?: string[]
  scripts?: string[]
  globals?: PresetGlobals
  plugins?: Plugin[]
  render: () => string
}

type Aliases = {
  [alias: string]: string
}

export type NovellaConfig = {
  aliases?: Aliases
  augment?: Partial<Omit<NovellaPreset, 'render'>>
  css?: string[]
  // preset?: NovellaPreset
}

export type PreviewOptions = {
  preset: NovellaPreset
} & NovellaConfig

export type WebviewUpdate = {
  options: PreviewOptions
  data: {
    component?: string
    css?: string
    novellaData?: string
  }
}
