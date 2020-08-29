import { getUserNameFromTweetUrl } from '../scripts/common'

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
    title: '이 사용자에게 체인맞블락 실행 (팔로워)',
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
    title: '이 사용자에게 체인맞블락 실행 (팔로잉)',
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
