'use strict'

const path = require('path')
const esbuild = require('esbuild')
const alias = require('esbuild-plugin-alias')

const dev = /^dev/i.test(process.env.NODE_ENV)

const base = {
  entryPoints: {
    background: './src/scripts/background/background.ts',
    twitter: './src/scripts/mirrorblock/twitter.ts',
    tweetdeck: './src/scripts/mirrorblock/tweetdeck.ts',
    twitter_inject: './src/scripts/inject/twitter-inject.ts',
    tweetdeck_inject: './src/scripts/inject/tweetdeck-inject.ts',
    chainblock: './src/scripts/chainblock/chainblock.ts',
    popup: './src/popup/popup.ts',
    options_ui: './src/options/options.ts',
  },
  outExtension: { '.js': '.bun.js' },
  // outdir: './build/bundled',
  bundle: true,
  target: [
    'es2022',
    'chrome100',
    'firefox91',
    'edge100',
  ],
  minifyWhitespace: !dev,
  minifyIdentifiers: !dev,
  minifySyntax: !dev,
  sourcemap: true,
}

async function main() {
	console.log('<esbuild> building...')
  const mv2 = esbuild.build({
    ...base,
    outdir: './build/bundled',
  })
  const mv3 = esbuild.build({
    ...base,
    outdir: './build-v3/bundled',
  })
  await Promise.all([mv2, mv3])
  console.log('<esbuild> DONE')
}

main()
