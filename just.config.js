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

const copyOptions = {
  stopOnErr: true,
  filter(filename) {
    return !/\.tsx?$/.test(filename)
  },
}

async function writeChromeManifest(manifest) {
  const chromeManifest = structuredClone(manifest)
  chromeManifest.background = {
    service_worker: manifest.background.scripts[0],
  }
  const manifestAsString = JSON.stringify(chromeManifest, null, 2)
  await fs.writeFile('build-chrome/manifest.json', manifestAsString, 'utf8')
}

async function copyBundledDirectory() {
  await cp('build-firefox/bundled/', 'build-chrome/bundled/', copyOptions)
}


task('check-tsc', async () => {
  await exec('tsc --noEmit')
})

task('bundle', async () => {
  // await exec('node esbuild.config.js')
  await esbuild.build(buildConfig)
  await copyBundledDirectory()
})

task('esbuild-watch', async () => {
  const copyBundles = {
    name: 'copy-bundles',
    setup(build) {
      build.onEnd(() => {
        copyBundledDirectory()
      })
    }
  }
  const watchLogger = {
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
  }
  const ctx = await esbuild.context({
    ...buildConfig,
    plugins: [watchLogger, copyBundles],
  })
  logger.info('esbuild: watching...')
  await ctx.watch()
})

task('copy-assets', async () => {
  await cp('src/', 'build-firefox/', copyOptions)
  await cp('src/', 'build-chrome/', copyOptions)
  await writeChromeManifest(manifest)
})

task('clean', async () => {
  await rmrf('build-firefox/')
  await rmrf('build-chrome/')
})

task('zip', async () => {
  const filenameFirefox = `${name}-v${version}-ff.zip`
  const filenameChrome = `${name}-v${version}-cr.zip`
  logger.info(`zipping into "dist/${filenameFirefox}"...`)
  await mkdirp('dist/')
  await exec(`7z a -r "dist/${filenameFirefox}" build-firefox/.`)
  await exec(`7z a -r "dist/${filenameChrome}" build-chrome/.`)
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
