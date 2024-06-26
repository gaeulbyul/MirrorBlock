import browser from 'webextension-polyfill'
import * as Options from '미러블락/extoption'
import { initializeContextMenus } from './context-menus'

type BrowserAction = typeof browser.browserAction

function updateBadge(option: MirrorBlockOption) {
  const { enableBlockReflection } = option
  const manifest = browser.runtime.getManifest()
  const versionName = manifest.version_name ?? manifest.version
  const browserAction: BrowserAction = browser.browserAction ?? (browser as any).action
  browserAction.setBadgeText({
    text: enableBlockReflection ? 'o' : '',
  })
  browserAction.setBadgeBackgroundColor({
    color: enableBlockReflection ? 'crimson' : 'gray',
  })
  browserAction.setTitle({
    title: [
      `Mirror Block v${versionName}`,
      `* ${browser.i18n.getMessage('block_reflection')}: ${enableBlockReflection ? 'On' : 'Off'}`,
    ].join('\n'),
  })
}

function initialize() {
  browser.storage.onChanged.addListener(changes => {
    const optionChange = changes.option
    if (!optionChange) {
      return
    }
    const option = optionChange.newValue as MirrorBlockOption
    updateBadge(option)
  })

  Options.load().then(updateBadge)
}

initialize()
initializeContextMenus()
