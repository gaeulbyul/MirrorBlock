import * as Options from '../extoption'
import { assertNever } from '../scripts/common'
import * as i18n from '../scripts/i18n'
import { initializeContextMenus } from './context-menus'
import * as TWApiBG from './twitter-api-bg'
import { initializeWebRequests } from './webrequest'

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
      `* ${i18n.getMessage('block_reflection')}: ${enableBlockReflection ? 'On' : 'Off'}`,
    ].join('\n'),
  })
}

async function initialize() {
  browser.storage.onChanged.addListener(changes => {
    const option = changes.option.newValue as MirrorBlockOption
    updateBadge(option)
  })

  const option = await Options.load()
  updateBadge(option)

  browser.runtime.onMessage.addListener(
    async (msg: object, _sender: browser.runtime.MessageSender): Promise<any> => {
      const message = msg as MBMessageFromContentToBackground
      switch (message.messageType) {
        case 'RequestAPI': {
          const { method, path, paramsObj, actAsUserId } = message
          const response = await TWApiBG.requestAPI(method, path, paramsObj, actAsUserId)
          return Promise.resolve<MBResponseAPIMessage>({
            messageType: 'ResponseAPI',
            response,
          })
        }
        case 'ExamineChainBlockableActor': {
          const { targetUserId } = message
          const actorId = await TWApiBG.examineChainBlockableActor(targetUserId)
          return Promise.resolve<MBChainBlockableActorResult>({
            messageType: 'ChainBlockableActorResult',
            actorId,
          })
        }
        default:
          assertNever(message)
      }
    }
  )
}

initialize()
initializeContextMenus()
initializeWebRequests()
