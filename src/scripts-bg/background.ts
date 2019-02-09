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

browser.storage.onChanged.addListener(changes => {
  const option = changes.option.newValue as MirrorBlockOption
  updateBadge(option)
})

async function initBadge() {
  const option = await MirrorBlock.Options.load()
  updateBadge(option)
}

initBadge()
