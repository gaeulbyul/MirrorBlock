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
