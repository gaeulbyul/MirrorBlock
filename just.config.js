const { task, series, parallel, logger } = require('just-scripts')
const util = require('util')
const proc = require('child_process')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const ncp = require('ncp')
const fs = require('fs-extra')

const manifest = require('./src/manifest.json')
const name = manifest.name.replace(/[^\w\-]+/gi, '')
const version = manifest.version

const esbuild = require('esbuild')
const buildConfig = require('./esbuild.config.js')

const cp = util.promisify(ncp)
const rmrf = util.promisify(rimraf)
const exec = util.promisify(proc.exec)

task('check-tsc', async () => {
  await exec('tsc --noEmit')
})

task('bundle', async () => {
  // await exec('node esbuild.config.js')
  await esbuild.build(buildConfig)
})

task('esbuild-watch', async () => {
  const watchLogger = () => [{
    name: 'log-on-build',
    setup(build) {
      build.onEnd(result =>
        void console.log(
          'build ended at: %s, with: %d Errors, %d Warnings',
          new Date().toLocaleTimeString(),
          result.errors.length,
          result.warnings.length,
        )
      )
    },
  }]
  const ctx = await esbuild.context({
    ...buildConfig,
    plugins: watchLogger(),
  })
  logger.info('esbuild: watching...')
  await ctx.watch()
})

task('copy-assets', async () => {
  const copyOptions = {
    stopOnErr: true,
    filter(filename) {
      return !/\.tsx?$/.test(filename)
    },
  }
  await cp('src/', 'build/', copyOptions)
})

task('clean', async () => {
  await rmrf('build/')
})

task('zip', async () => {
  const filename = `${name}-v${version}.zip`
  logger.info(`zipping into "dist/${filename}"...`)
  await mkdirp('dist/')
  await exec(`7z a -r "dist/${filename}" build/.`)
})

task('srczip', async () => {
  await mkdirp('dist/')
  await exec(`git archive -9 -v -o ./dist/${name}-v${version}.Source.zip HEAD`)
})

task('generate-i18n-interface', async () => {
  await exec(
    'node scripts/generate-i18n-interface.js < src/_locales/ko/messages.json > src/scripts/i18n.d.ts',
  )
})

task('build', parallel('copy-assets', 'bundle'))
task('default', series('clean', 'build'))
task('dist', parallel('zip', 'srczip'))
task('all', series('default', 'dist'))
