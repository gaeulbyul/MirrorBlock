import { getUserNameFromTweetUrl } from '../scripts/common'
import * as i18n from '../scripts/i18n'

function getUserNameFromClickInfo(info: browser.contextMenus.OnClickData): string | null {
  const { linkUrl } = info
  if (!linkUrl) {
    return null
  }
  const url = new URL(linkUrl)
  return getUserNameFromTweetUrl(url)
}

export function initializeContextMenus() {
  const contexts: browser.contextMenus.ContextType[] = ['link']
  const documentUrlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
  const targetUrlPatterns = documentUrlPatterns
  browser.contextMenus.create({
    contexts,
    documentUrlPatterns,
    targetUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_followers_contextmenu'),
    onclick(clickInfo, tab) {
      const tabId = tab.id!
      const userName = getUserNameFromClickInfo(clickInfo)
      if (!userName) {
        return
      }
      browser.tabs.sendMessage<MBStartChainBlockMessage>(tabId, {
        messageType: 'StartChainBlock',
        followType: 'followers',
        userName,
      })
    },
  })
  browser.contextMenus.create({
    contexts,
    documentUrlPatterns,
    targetUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_following_contextmenu'),
    onclick(clickInfo, tab) {
      const tabId = tab.id!
      const userName = getUserNameFromClickInfo(clickInfo)
      if (!userName) {
        return
      }
      browser.tabs.sendMessage<MBStartChainBlockMessage>(tabId, {
        messageType: 'StartChainBlock',
        followType: 'following',
        userName,
      })
    },
  })
}
