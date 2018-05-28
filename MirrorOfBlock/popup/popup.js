/* globals URL, browser, ExtOption */

function isChainBlockablePage (urlstr) {
  try {
    const url = new URL(urlstr)
    if (url.hostname !== 'twitter.com') {
      return false
    }
    return /^\/@?[\w\d_]+\/(?:followers|following)$/.test(url.pathname)
  } catch (e) {
    return false
  }
}

async function executeChainBlock () {
  const tabs = await browser.tabs.query({active: true, currentWindow: true})
  const currentTab = tabs[0]
  if (!isChainBlockablePage(currentTab.url)) {
    window.alert(`PC용 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.
(예: https://twitter.com/(UserName)/followers)`)
    return
  }
  browser.tabs.sendMessage(currentTab.id, {
    action: 'MirrorOfBlock/start-chainblock'
  })
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.menu-item.chain-block').onclick = event => {
    event.preventDefault()
    executeChainBlock()
  }
  document.querySelector('.menu-item.open-option').onclick = event => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  }
  ExtOption.load().then(option => {
    {
      const blockReflection = document.querySelector('.blockReflection')
      const val = option.enableBlockReflection
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
