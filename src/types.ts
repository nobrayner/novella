import type { Plugin } from 'esbuild'
import type { ModuleInfo } from '@fal-works/esbuild-plugin-global-externals'

export type PresetGlobals = Record<string, string | ModuleInfo>

export type NovellaPreset = {
  external?: string[]
  scripts?: string[]
  globals?: PresetGlobals
  plugins?: Plugin[]
  render: (component: any, props: any) => void
}

export type NovellaConfig = {
  augment?: Partial<Omit<NovellaPreset, 'render'>>
  css?: string[]
}

export type PreviewOptions = {
  preset: NovellaPreset
} & NovellaConfig

export type WebviewUpdateData = {
  component?: string
  css?: string
  novellaData?: string
}
export type WebviewUpdate = {
  options: PreviewOptions
  data: WebviewUpdateData
}
