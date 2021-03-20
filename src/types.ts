import rollup from 'rollup'

export type NovellaPreset = {
  plugins: rollup.Plugin[]
  externals?: (string | RegExp)[]
  globals?: rollup.GlobalsOption
  scripts?: string[]
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
