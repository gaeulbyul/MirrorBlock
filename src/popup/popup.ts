function closePopup() {
  window.close()
}

namespace MirrorBlock.Popup {
  const { getUserNameFromTweetUrl } = MirrorBlock.Utils
  type Tab = browser.tabs.Tab

  async function alertToTab(tabId: number, message: string) {
    return browser.tabs.sendMessage<MBAlertMessage>(tabId, {
      action: Action.Alert,
      message,
    })
  }

  async function getCurrentTab(): Promise<Tab | null> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]
    if (!currentTab.url || !currentTab.id) {
      return null
    }
    return currentTab
  }

  async function executeChainBlock(followType: FollowType) {
    const currentTab = await getCurrentTab()
    if (!(currentTab && typeof currentTab.id === 'number')) {
      return
    }
    const tabId = currentTab.id
    const url = new URL(currentTab.url!)
    if (url.hostname === 'tweetdeck.twitter.com') {
      const a = 'Mirror Block: 트윗덱에선 작동하지 않습니다.'
      const b = '트위터(https://twitter.com)에서 실행해주세요.'
      const message = `${a}\n${b}`
      alertToTab(tabId, message)
      closePopup()
      return
    }
    const userName = getUserNameFromTweetUrl(url)
    if (!userName) {
      const a =
        'Mirror Block: 체인맞블락을 사용하시려면 사용자의 프로필페이지로 이동해주세요.'
      const b = '( 예: https://twitter.com/(사용자이름) )'
      const message = `${a}\n${b}`
      alertToTab(tabId, message)
      closePopup()
      return
    }
    browser.tabs
      .sendMessage<MBStartChainBlockMessage>(tabId, {
        action: Action.StartChainBlock,
        followType,
        userName,
      })
      .then(closePopup)
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const currentTab = await getCurrentTab()
    if (currentTab && currentTab.url) {
      const currentUrl = new URL(currentTab.url!)
      const cbButtons = document.querySelectorAll<HTMLButtonElement>(
        'button.chain-block'
      )
      const supportingHostname = ['twitter.com', 'mobile.twitter.com']
      if (supportingHostname.includes(currentUrl.hostname)) {
        cbButtons.forEach(el => (el.disabled = false))
      } else {
        cbButtons.forEach(
          el => (el.title = '체인맞블락은 트위터 내에서 사용할 수 있습니다.')
        )
      }
    }
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
      const currentVersion = document.querySelector<HTMLElement>(
        '.currentVersion'
      )!
      currentVersion.textContent = `버전: ${manifest.version}`
      currentVersion.title = `Mirror Block 버전 ${manifest.version}을(를) 사용하고 있습니다.`
    }
    {
      const options = await MirrorBlock.Options.load()
      const blockReflection = document.querySelector<HTMLElement>(
        '.blockReflection'
      )!
      const val = options.enableBlockReflection
      // const warningEmoji = '\u{26a0}\u{fe0f}'
      blockReflection.classList.toggle('on', val)
      blockReflection.textContent = `차단반사: ${val ? 'On \u2714' : 'Off'}`
    }
  })
}
