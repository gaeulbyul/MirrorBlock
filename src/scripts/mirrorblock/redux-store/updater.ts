import type { TwitterUserMap } from '미러블락/scripts/common'

// 파이어폭스에서 CustomEvent의 detail 개체 전달용
export function cloneDetail<T>(detail: T): T {
  if (typeof detail !== 'object') {
    return detail
  }
  if (typeof cloneInto === 'function') {
    return cloneInto(detail, document.defaultView)
  } else {
    return detail
  }
}

function triggerPageEvent(eventName: ReduxStoreEventNames, eventDetail?: object): void {
  const detail = cloneDetail(eventDetail)
  const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
    detail,
  })
  requestIdleCallback(() => document.dispatchEvent(requestEvent), {
    timeout: 5000,
  })
}

export async function insertSingleUserIntoStore(user: TwitterUser): Promise<void> {
  triggerPageEvent('insertSingleUserIntoStore', {
    user,
  })
}

export async function insertMultipleUsersIntoStore(usersMap: TwitterUserMap): Promise<void> {
  const usersObj = usersMap.toUserObject()
  triggerPageEvent('insertMultipleUsersIntoStore', {
    users: usersObj,
  })
}

export async function afterBlockUser(user: TwitterUser): Promise<void> {
  triggerPageEvent('afterBlockUser', {
    user,
  })
  const clonedUser = Object.assign({}, user)
  clonedUser.blocking = true
  insertSingleUserIntoStore(clonedUser)
}

export async function toastMessage(text: string): Promise<void> {
  triggerPageEvent('toastMessage', {
    text,
  })
}
