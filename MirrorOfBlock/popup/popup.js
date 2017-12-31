/* globals URL, browser */

function isChainBlockablePage (urlstr) {
  try {
    const url = new URL(urlstr)
    if (url.hostname !== 'twitter.com') {
      return false
    }
    return /^\/@?[\w\d_]+\/(?:followers|followings)$/.test(url.pathname)
  } catch (e) {
    return false
  }
}

function injectChainBlockScript (src, document) {
  const script = document.createElement('script')
  script.src = src
  // script.onload = function () { this.remove() }
  ;(document.head || document.documentElement).appendChild(script)
}

async function executeChainBlock () {
  const tabs = await browser.tabs.query({active: true, currentWindow: true})
  const currentTab = tabs[0]
  if (!isChainBlockablePage(currentTab.url)) {
    window.alert('You should go followers or followings page on twitter.com')
    return
  }
  const scriptUrl = browser.runtime.getURL('/page_scripts/chainblock.js')
  const code = `(${injectChainBlockScript.toString()})('${scriptUrl}', window.document)`
  browser.tabs.executeScript(currentTab.id, {
    code
  })
  /*
  browser.tabs.executeScript(currentTab.id, {
    file: '/page_scripts/chainblock.js'
  })
  */
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
