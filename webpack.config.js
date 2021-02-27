const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    background: './src/scripts/background/background.ts',
    twitter: './src/scripts/mirrorblock/twitter.ts',
    tweetdeck: './src/scripts/mirrorblock/tweetdeck.ts',
    twitter_inject: './src/scripts/inject/twitter-inject.ts',
    tweetdeck_inject: './src/scripts/inject/tweetdeck-inject.ts',
    chainblock: './src/scripts/chainblock/chainblock.ts',
    popup: './src/popup/popup.ts',
    options_ui: './src/options/options.ts',
  },
  output: {
    path: `${__dirname}/build/bundled`,
    filename: '[name].bun.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        // use: 'ts-loader',
        use: 'swc-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    // new webpack.ProvidePlugin({
    //   browser: 'webextension-polyfill'
    // })
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      미러블락: path.resolve(__dirname, 'src/'),
    },
  },
  watchOptions: {
    poll: 400,
  },
}
