namespace MirrorBlockBackground.Menu {
  const { getUserNameFromTweetUrl } = MirrorBlock.Utils
  function getUserNameFromClickInfo(
    info: browser.contextMenus.OnClickData
  ): string | null {
    const { linkUrl } = info
    if (!linkUrl) {
      return null
    }
    const url = new URL(linkUrl)
    return getUserNameFromTweetUrl(url)
  }
  export function initialize() {
    const contexts: browser.contextMenus.ContextType[] = ['link']
    const documentUrlPatterns = [
      'https://twitter.com/*',
      'https://mobile.twitter.com/*',
    ]
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
          action: Action.StartChainBlock,
          followType: FollowType.followers,
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
          action: Action.StartChainBlock,
          followType: FollowType.following,
          userName,
        })
      },
    })
  }
}

namespace MirrorBlockBackground {
  async function updateBadge(option: MirrorBlockOption) {
    const { enableBlockReflection } = option
    const manifest = browser.runtime.getManifest()
    browser.browserAction.setBadgeText({
      text: enableBlockReflection ? 'o' : '',
    })
    browser.browserAction.setBadgeBackgroundColor({
      color: enableBlockReflection ? 'crimson' : 'gray',
    })
    browser.browserAction.setTitle({
      title: [
        `Mirror Block v${manifest.version}`,
        `* 차단 반사: ${enableBlockReflection ? 'On' : 'Off'}`,
      ].join('\n'),
    })
  }
  export async function initialize() {
    browser.storage.onChanged.addListener(changes => {
      const option = changes.option.newValue as MirrorBlockOption
      updateBadge(option)
    })

    const option = await MirrorBlock.Options.load()
    updateBadge(option)

    browser.runtime.onMessage.addListener(
      async (
        msg: object,
        _sender: browser.runtime.MessageSender
      ): Promise<any> => {
        const message = msg as MBMessage
        switch (message.action) {
          case Action.RequestAPI: {
            const { method, path, paramsObj } = message
            const response = await MirrorBlockBackground.TwitterAPI.requestAPI(
              method,
              path,
              paramsObj
            )
            return Promise.resolve<MBResponseAPIMessage>({
              action: Action.ResponseAPI,
              response,
            })
          }
        }
      }
    )
  }
}

MirrorBlockBackground.initialize()
MirrorBlockBackground.Menu.initialize()
