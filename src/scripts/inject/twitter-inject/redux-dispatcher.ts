import { v1 as uuidv1 } from 'uuid'

function addEvent(name: ReduxStoreEventNames, callback: (event: CustomEvent) => void): void {
  document.addEventListener(`MirrorBlock->${name}`, event => {
    const customEvent = event as CustomEvent
    callback(customEvent)
  })
}
export function listenEvent(reduxStore: ReduxStore): void {
  addEvent('insertSingleUserIntoStore', event => {
    const user: TwitterUser = event.detail.user
    reduxStore.dispatch({
      type: 'rweb/entities/ADD_ENTITIES',
      payload: {
        users: {
          [user.id_str]: user,
        },
      },
    })
  })
  addEvent('insertMultipleUsersIntoStore', event => {
    const users: TwitterUserEntities = event.detail.users
    reduxStore.dispatch({
      type: 'rweb/entities/ADD_ENTITIES',
      payload: {
        users,
      },
    })
  })
  addEvent('afterBlockUser', event => {
    const { user } = event.detail
    const userId = user.id_str
    const uniqId = uuidv1()
    reduxStore.dispatch({
      type: 'rweb/blockedUsers/BLOCK_REQUEST',
      optimist: {
        id: uniqId,
        type: 'BEGIN',
      },
      meta: {
        userId,
      },
    })
  })
  addEvent('toastMessage', event => {
    const { text } = event.detail
    reduxStore.dispatch({
      type: 'rweb/toasts/ADD_TOAST',
      payload: { text },
    })
  })
}
