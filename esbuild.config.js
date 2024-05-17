'use strict'

const path = require('path')
const esbuild = require('esbuild')
const alias = require('esbuild-plugin-alias')

const dev = /^dev/i.test(process.env.NODE_ENV)

const buildConfig = {
  entryPoints: {
    background: './src/scripts/background/background.ts',
    twitter: './src/scripts/mirrorblock/twitter.ts',
    twitter_inject: './src/scripts/inject/twitter-inject.ts',
    chainblock: './src/scripts/chainblock/chainblock.ts',
    popup: './src/popup/popup.ts',
    options_ui: './src/options/options.ts',
  },
  outdir: './build-firefox/bundled',
  outExtension: { '.js': '.bun.js' },
  bundle: true,
  minifyWhitespace: !dev,
  minifyIdentifiers: !dev,
  minifySyntax: !dev,
  sourcemap: true,
}

async function main() {
  console.log('<esbuild> building...')
  await esbuild.build(buildConfig)
  console.log('<esbuild> DONE')
}

module.exports = buildConfig

if (require.main == module) {
  main()
}
