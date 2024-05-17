function addEventWithResponse(
  name: ReduxStoreEventNames,
  callback: (event: CustomEvent) => any,
): void {
  document.addEventListener(`MirrorBlock-->${name}`, event => {
    const customEvent = event as CustomEvent
    const { nonce } = customEvent.detail
    const response = callback(customEvent)
    const responseEvent = new CustomEvent(`MirrorBlock<--${name}.${nonce}`, {
      detail: response,
    })
    document.dispatchEvent(responseEvent)
  })
}
export function listenEvent(reduxStore: ReduxStore): void {
  addEventWithResponse('getMultipleUsersByIds', event => {
    const state = reduxStore.getState()
    const { userIds } = event.detail
    const result: { [id: string]: TwitterUser } = {}
    const userEntities: TwitterUserEntities = (state?.entities?.users?.entities) || []
    for (const userId of userIds) {
      result[userId] = userEntities[userId]!
    }
    return result
  })
  addEventWithResponse('getUserByName', event => {
    const state = reduxStore.getState()
    const { userName } = event.detail
    const targetUserName = userName.toLowerCase()
    const userEntities: TwitterUserEntities = (state?.entities?.users?.entities) || []
    for (const userEntity of Object.values(userEntities)) {
      const name = userEntity.screen_name.toLowerCase()
      if (targetUserName === name) {
        return userEntity
      }
    }
    return null
  })
  addEventWithResponse('getDMData', event => {
    const state = reduxStore.getState()
    const { convId } = event.detail
    const conversations = state?.directMessages?.conversations
    if (!conversations) {
      return null
    }
    const convData = conversations?.[convId]
    return convData || null
  })
}
