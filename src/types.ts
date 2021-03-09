import rollup from 'rollup'

export type NovellaPreset = {
  plugins: rollup.Plugin[]
  externals?: rollup.ExternalOption
  globals?: rollup.GlobalsOption
  scripts?: string[]
  render: () => string
}
