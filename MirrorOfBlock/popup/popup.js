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

function injectChainBlockScript (src, options) {
  window.sessionStorage.setItem('$MirrorOfBlockOptions', options)
  const script = document.createElement('script')
  script.src = src
  ;(document.head || document.documentElement).appendChild(script)
}

async function executeChainBlock () {
  const options = await ExtOption.load()
  const optionsJSON = JSON.stringify(options)
  const tabs = await browser.tabs.query({active: true, currentWindow: true})
  const currentTab = tabs[0]
  if (!isChainBlockablePage(currentTab.url)) {
    window.alert(`PC용 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.
(예: https://twitter.com/(UserName)/followers)`)
    return
  }
  const scripts = ['/scripts/block.js', '/scripts/chainblock.js']
  for (const script of scripts) {
    const scriptUrl = browser.runtime.getURL(script)
    const code = `(${injectChainBlockScript.toString()})('${scriptUrl}', \`${optionsJSON}\`)`
    browser.tabs.executeScript(currentTab.id, {
      code
    })
  }
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
})
