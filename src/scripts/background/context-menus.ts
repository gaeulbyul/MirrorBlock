import browser from 'webextension-polyfill'
import { sendBrowserTabMessage } from '미러블락/scripts/browser-apis'
import { getUserNameFromTweetUrl } from '미러블락/scripts/common'
import i18n from '미러블락/scripts/i18n'

function getUserNameFromClickInfo(info: browser.Menus.OnClickData): string | null {
  const { linkUrl } = info
  if (!linkUrl) {
    return null
  }
  const url = new URL(linkUrl)
  return getUserNameFromTweetUrl(url)
}

browser.contextMenus.onClicked.addListener((clickInfo, tab) => {
  if (!tab) {
    return
  }
  const tabId = tab.id!
  const userName = getUserNameFromClickInfo(clickInfo)
  if (!userName) {
    return
  }
  let followKind: FollowKind
  switch (clickInfo.menuItemId) {
    case 'run_chainblock_from_followers_contextmenu':
      followKind = 'followers'
      break
    case 'run_chainblock_from_following_contextmenu':
      followKind = 'following'
      break
    default:
      throw new Error('unreachable')
  }
  sendBrowserTabMessage<MBStartChainBlockMessage>(tabId, {
    action: 'MirrorBlock/StartChainBlock',
    followKind,
    userName,
  })
})

export async function initializeContextMenus() {
  await browser.contextMenus.removeAll()
  const documentUrlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
  const targetUrlPatterns = documentUrlPatterns
  browser.contextMenus.create({
    id: 'run_chainblock_from_followers_contextmenu',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns,
    title: i18n.run_chainblock_from_followers_contextmenu(),
  })
  browser.contextMenus.create({
    id: 'run_chainblock_from_following_contextmenu',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns,
    title: i18n.run_chainblock_from_following_contextmenu(),
  })
}
