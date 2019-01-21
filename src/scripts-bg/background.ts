async function updateBadge(option: MirrorOfBlockOption) {
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
      `Mirror Of Block v${manifest.version}`,
      `* 차단 반사: ${enableBlockReflection ? 'On' : 'Off'}`,
    ].join('\n'),
  })
}

browser.storage.onChanged.addListener(changes => {
  const option = changes.option.newValue as MirrorOfBlockOption
  updateBadge(option)
})

async function initBadge() {
  const option = await ExtOption.load()
  updateBadge(option)
}

initBadge()
