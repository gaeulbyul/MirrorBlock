import browser from 'webextension-polyfill'
import * as Options from '미러블락/extoption'
import { sendBrowserTabMessage } from '미러블락/scripts/browser-apis'
import { getUserNameFromTweetUrl } from '미러블락/scripts/common'
import { applyI18NOnHtml } from '미러블락/scripts/i18n'

function closePopup() {
  window.close()
}

async function alertToTab(tabId: number, message: string) {
  return sendBrowserTabMessage<MBAlertMessage>(tabId, {
    action: 'MirrorBlock/Alert',
    message,
  })
}

async function getCurrentTab(): Promise<browser.Tabs.Tab | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const currentTab = tabs[0]
  if (currentTab && currentTab.url && currentTab.id) {
    return currentTab
  }
  return null
}

async function executeChainBlock(followKind: FollowKind) {
  const currentTab = await getCurrentTab()
  if (!(currentTab && typeof currentTab.id === 'number')) {
    return
  }
  const tabId = currentTab.id
  const url = new URL(currentTab.url!)
  const userName = getUserNameFromTweetUrl(url)
  if (!userName) {
    const a = browser.i18n.getMessage('please_run_on_profile_page_1')
    const b = browser.i18n.getMessage('please_run_on_profile_page_2')
    const message = `${a}\n${b}`
    alertToTab(tabId, message)
    closePopup()
    return
  }
  sendBrowserTabMessage<MBStartChainBlockMessage>(tabId, {
    action: 'MirrorBlock/StartChainBlock',
    followKind,
    userName,
  }).then(closePopup)
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18NOnHtml()
  const currentTab = await getCurrentTab()
  if (currentTab && currentTab.url) {
    const currentUrl = new URL(currentTab.url!)
    const cbButtons = document.querySelectorAll<HTMLButtonElement>('button.chain-block')
    if (currentUrl.hostname === 'twitter.com' || currentUrl.hostname === 'x.com') {
      cbButtons.forEach(el => {
        el.disabled = false
      })
    } else {
      cbButtons.forEach(el => {
        el.title = browser.i18n.getMessage('running_chainblock_is_only_available_on_twitter')
      })
    }
  }
  document.querySelector('.menu-item.chain-block-followers')!.addEventListener('click', event => {
    event.preventDefault()
    executeChainBlock('followers')
  })
  document.querySelector('.menu-item.chain-block-following')!.addEventListener('click', event => {
    event.preventDefault()
    executeChainBlock('following')
  })
  document.querySelector('.menu-item.open-option')!.addEventListener('click', event => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  })
  {
    const manifest = browser.runtime.getManifest()
    const versionName = manifest.version_name ?? manifest.version
    const currentVersion = document.querySelector<HTMLElement>('.currentVersion')!
    currentVersion.textContent = `Mirror Block v${versionName}`
  }
  {
    const options = await Options.load()
    const blockReflection = document.querySelector<HTMLElement>('.blockReflection')!
    const val = options.enableBlockReflection
    blockReflection.classList.toggle('on', val)
    blockReflection.textContent = `${browser.i18n.getMessage('block_reflection')}: ${val ? 'On \u2714' : 'Off'}`
  }
})
