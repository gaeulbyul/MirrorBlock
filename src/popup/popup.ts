function closePopup() {
  window.close()
}

function extractUserNameFromUrl(url: URL): string | null {
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
  if (!supportingHostname.includes(url.hostname)) {
    return null
  }
  const notUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
  if (notUserPagePattern01.test(url.pathname)) {
    return null
  }
  const pattern = /^\/([0-9a-z_]+)/i
  const match = pattern.exec(url.pathname)
  if (!match) {
    return null
  }
  const userName = match[1]
  return userName
}

async function executeChainBlock(followType: FollowType) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const currentTab = tabs[0]
  if (!currentTab.url || !currentTab.id) {
    return
  }
  const parsedUrl = new URL(currentTab.url)
  if (parsedUrl.hostname === 'tweetdeck.twitter.com') {
    const message = String.raw`Mirror Block: 트윗덱에선 작동하지 않습니다. 트위터(https://twitter.com)에서 실행해주세요.`.replace(
      /'/g,
      ''
    )
    browser.tabs
      .executeScript(currentTab.id, {
        code: `window.alert('${message}')`,
      })
      .then(closePopup)
    return
  }
  const userName = extractUserNameFromUrl(parsedUrl)
  if (!userName) {
    const message = String.raw`Mirror Block: 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.\n(예: https://twitter.com/(UserName)/followers)`.replace(
      /'/g,
      ''
    )
    browser.tabs
      .executeScript(currentTab.id, {
        code: `window.alert('${message}')`,
      })
      .then(closePopup)
    return
  }
  browser.tabs
    .sendMessage<MBMessage>(currentTab.id, {
      action: Action.StartChainBlock,
      followType,
      userName,
    })
    .then(closePopup)
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelector('.menu-item.chain-block-followers')!
    .addEventListener('click', event => {
      event.preventDefault()
      executeChainBlock(FollowType.followers)
    })
  document
    .querySelector('.menu-item.chain-block-following')!
    .addEventListener('click', event => {
      event.preventDefault()
      executeChainBlock(FollowType.following)
    })
  document
    .querySelector('.menu-item.open-option')!
    .addEventListener('click', event => {
      event.preventDefault()
      browser.runtime.openOptionsPage()
    })
  {
    const manifest = browser.runtime.getManifest()
    const currentVersion = document.querySelector(
      '.currentVersion'
    ) as HTMLElement
    currentVersion.textContent = `버전: ${manifest.version}`
    currentVersion.title = `Mirror Block 버전 ${
      manifest.version
    }을(를) 사용하고 있습니다.`
  }
  MirrorBlock.Options.load().then(option => {
    {
      const blockReflection = document.querySelector(
        '.blockReflection'
      ) as HTMLElement
      const val = option.enableBlockReflection
      // const warningEmoji = '\u{26a0}\u{fe0f}'
      blockReflection.classList.toggle('on', val)
      blockReflection.textContent = `차단반사: ${val ? 'On \u2714' : 'Off'}`
    }
  })
})
