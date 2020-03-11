import { cloneDetail } from './updater'

async function triggerPageEventWithResponse(
  eventName: ReduxStoreEventNames,
  eventDetail?: object
): Promise<any> {
  const detail = cloneDetail(eventDetail)
  const nonce = Math.random()
  Object.assign(detail, {
    nonce,
  })
  const requestEvent = new CustomEvent(`MirrorBlock-->${eventName}`, {
    detail,
  })
  return new Promise((resolve, reject) => {
    let timeouted = false
    const timeout = window.setTimeout(() => {
      timeouted = true
      reject('timeout!')
    }, 10000)
    document.addEventListener(
      `MirrorBlock<--${eventName}.${nonce}`,
      event => {
        window.clearTimeout(timeout)
        if (timeouted) {
          return
        }
        const customEvent = event as CustomEvent
        resolve(customEvent.detail)
      },
      { once: true }
    )
    document.dispatchEvent(requestEvent)
  })
}

export async function getMultipleUsersByIds(
  userIds: string[]
): Promise<TwitterUser[]> {
  return triggerPageEventWithResponse('getMultipleUsersByIds', {
    userIds,
  })
}

export async function getUserById(userId: string): Promise<TwitterUser | null> {
  const users = await triggerPageEventWithResponse('getMultipleUsersByIds', {
    userIds: [userId],
  }).catch(() => {})
  return users[userId] || null
}

export async function getUserByName(
  userName: string
): Promise<TwitterUser | null> {
  return triggerPageEventWithResponse('getUserByName', {
    userName,
  })
}

export async function getDMData(convId: string): Promise<DMData | null> {
  return triggerPageEventWithResponse('getDMData', {
    convId,
  })
}
