import * as esbuild from 'esbuild'
// @ts-ignore There aren't any types!
import svgr from '@svgr/core'
import fs from 'fs'

const svgPlugin = (): esbuild.Plugin => ({
  name: 'simple-svg',
  setup(build) {
    build.onLoad({ filter: /\.svg$/ }, async (args) => {
      const svgCode = fs.readFileSync(args.path)

      const transformSvgCodeToDataUrl = await esbuild.transform(
        svgCode.toString(),
        {
          format: 'esm',
          loader: 'dataurl',
        }
      )

      const svgReactComponent = await svgr(
        svgCode,
        { namedExport: 'ReactComponent' },
        {
          componentName: 'SvgComponent',
          caller: {
            name: 'simple-svg',
            previousExport: transformSvgCodeToDataUrl.code,
          },
        }
      )

      return {
        contents: svgReactComponent,
        loader: 'jsx',
      }
    })
  },
})

export default svgPlugin
