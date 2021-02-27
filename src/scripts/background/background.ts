import * as Options from '미러블락/extoption'
import { initializeContextMenus } from './context-menus'
import { initializeWebRequests } from './webrequest'

async function updateBadge(option: MirrorBlockOption) {
  const { enableBlockReflection } = option
  const manifest = browser.runtime.getManifest()
  browser.browserAction.setBadgeText({
    text: enableBlockReflection ? 'o' : '',
  })
  browser.browserAction.setBadgeBackgroundColor({
    color: enableBlockReflection ? 'crimson' : 'gray',
  })
  browser.browserAction.setTitle({
    title: [
      `Mirror Block v${manifest.version}`,
      `* 차단 반사: ${enableBlockReflection ? 'On' : 'Off'}`,
    ].join('\n'),
  })
}

async function initialize() {
  browser.storage.onChanged.addListener(changes => {
    const option = changes.option.newValue as MirrorBlockOption
    updateBadge(option)
  })

  const option = await Options.load()
  updateBadge(option)
}

initialize()
initializeContextMenus()
initializeWebRequests()
