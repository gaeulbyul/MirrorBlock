/* globals URL, browser, ExtOption */

const userNameBlacklist = [
  '1',
  'about',
  'account',
  'blog',
  'followers',
  'followings',
  'hashtag',
  'i',
  'lists',
  'login',
  'logout',
  'oauth',
  'privacy',
  'search',
  'tos',
  'notifications',
  'messages',
  'explore',
  'home'
]

function extractUserNameFromUrl (urlstr) {
  const url = new URL(urlstr)
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
  if (!supportingHostname.includes(url.hostname)) {
    return null
  }
  const notUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
  if (notUserPagePattern01.test(url.pathname)) {
    return null
  }
  const pattern = /^\/([0-9A-Za-z_]+)/
  const match = pattern.exec(url.pathname)
  if (!match) {
    return null
  }
  const userName = match[1]
  if (userNameBlacklist.includes(userName.toLowerCase())) {
    return null
  }
  return userName
}

async function executeChainBlock (followType) {
  const tabs = await browser.tabs.query({active: true, currentWindow: true})
  const currentTab = tabs[0]
  const userName = extractUserNameFromUrl(currentTab.url)
  if (!userName) {
    const message = String.raw`Mirror Of Block: 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.\n(예: https://twitter.com/(UserName)/followers)`.replace(/'/g, '')
    browser.tabs.executeScript(currentTab.id, {
      code: `window.alert('${message}')`
    })
    return
  }
  browser.tabs.sendMessage(currentTab.id, {
    action: 'MirrorOfBlock/start-chainblock',
    followType,
    userName
  })
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.menu-item.chain-block-followers').onclick = event => {
    event.preventDefault()
    executeChainBlock('followers')
  }
  document.querySelector('.menu-item.chain-block-following').onclick = event => {
    event.preventDefault()
    executeChainBlock('following')
  }
  document.querySelector('.menu-item.open-option').onclick = event => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  }
  {
    const manifest = browser.runtime.getManifest()
    const currentVersion = document.querySelector('.currentVersion')
    currentVersion.textContent = `버전: ${manifest.version}`
    currentVersion.title = `Mirror Of Block 버전 ${manifest.version}을(를) 사용하고 있습니다.`
  }
  ExtOption.load().then(option => {
    {
      const blockReflection = document.querySelector('.blockReflection')
      const val = option.enableBlockReflection
      // const warningEmoji = '\u{26a0}\u{fe0f}'
      blockReflection.classList.toggle('on', val)
      blockReflection.textContent = `차단반사: ${val ? 'On \u2714' : 'Off'}`
    }
    {
      const over10KMode = document.querySelector('.chainBlockOver10KMode')
      const val = option.chainBlockOver10KMode
      over10KMode.classList.toggle('on', val)
      over10KMode.textContent = `슬로우모드: ${val ? 'On \u2714' : 'Off'}`
    }
  })
})

// Yandex 브라우저의 경우, 버튼을 누르고 나서도 팝업창이 닫히지 않는다.
// 따라서, Chainblock 함수를 실행할 때 confirmed-chainblock메시지를 보내고,
// 팝업창은 이를 감지하면 창을 닫도록 한다.
browser.runtime.onMessage.addListener(msg => {
  console.info('message received from popup: %j', msg)
  if (msg.action === 'MirrorOfBlock/confirmed-chainblock') {
    window.close()
  }
})
