namespace MirrorBlock.Mobile.Redux {
  export namespace StoreUpdater {
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
    function triggerPageEvent(
      eventName: ReduxStoreEventNames,
      eventDetail?: object
    ): void {
      const detail = cloneDetail(eventDetail)
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      requestIdleCallback(() => document.dispatchEvent(requestEvent), {
        timeout: 5000,
      })
    }
    export async function insertSingleUserIntoStore(
      user: TwitterUser
    ): Promise<void> {
      triggerPageEvent('insertSingleUserIntoStore', {
        user,
      })
    }
    export async function insertMultipleUsersIntoStore(
      usersMap: TwitterUserMap
    ): Promise<void> {
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
  }
  export namespace StoreRetriever {
    const { cloneDetail } = StoreUpdater
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
    export async function getUserById(
      userId: string
    ): Promise<TwitterUser | null> {
      const users = await triggerPageEventWithResponse(
        'getMultipleUsersByIds',
        {
          userIds: [userId],
        }
      ).catch(() => {})
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
  }
  export namespace UserGetter {
    const { isTwitterUser } = MirrorBlock.Utils
    // API호출 실패한 사용자이름을 저장하여 API호출을 반복하지 않도록 한다.
    // (예: 지워지거나 정지걸린 계정)
    const failedUserParams = new Set<string>()
    function errorHandler(failedIdOrNames: string[]): (err: any) => void {
      return (err: any) => {
        failedIdOrNames.forEach(idOrName => failedUserParams.add(idOrName))
        console.error(err)
      }
    }
    // 2019-07-08
    // reduxStore.dispatch('rweb/BATCH', ...)를 통해 들어온 사용자 정보엔
    // id_str 과 screen_name 만 들어있는 경우가 있다.
    // 정보값이 불충분하므로 store에 없는 사용자로 취급
    function checkObjectIsUser(
      obj: object | null,
      n: number
    ): obj is TwitterUser {
      if (!obj) {
        return false
      }
      const keys = Object.keys(obj)
      if (keys.length <= n) {
        return false
      }
      return isTwitterUser(obj)
    }
    export async function getUserById(
      userId: string,
      useAPI: boolean
    ): Promise<TwitterUser | null> {
      if (failedUserParams.has(userId)) {
        return null
      }
      const userFromStore = await StoreRetriever.getUserById(userId)
      if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
        return userFromStore
      } else if (useAPI) {
        console.log('request api "%s"', userId)
        const user = await TwitterAPI.getSingleUserById(userId).catch(
          errorHandler([userId])
        )
        if (user) {
          StoreUpdater.insertSingleUserIntoStore(user)
        }
        return user || null
      } else {
        return null
      }
    }
    export async function getUserByName(
      userName: string,
      useAPI: boolean
    ): Promise<TwitterUser | null> {
      const loweredName = userName.toLowerCase()
      if (failedUserParams.has(loweredName)) {
        return null
      }
      const userFromStore = await StoreRetriever.getUserByName(loweredName)
      if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
        return userFromStore
      } else if (useAPI) {
        console.log('request api "@%s"', userName)
        const user = await TwitterAPI.getSingleUserByName(userName).catch(
          errorHandler([userName])
        )
        if (user) {
          StoreUpdater.insertSingleUserIntoStore(user)
        }
        return user || null
      } else {
        return null
      }
    }
    export async function getMultipleUsersById(
      userIds: string[]
    ): Promise<TwitterUserMap> {
      if (userIds.length > 100) {
        throw new Error('too many user!')
      }
      const userMap = new TwitterUserMap()
      const idsToRequestAPI: string[] = []
      for (const userId of userIds) {
        const userFromStore = await StoreRetriever.getUserById(userId)
        if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
          userMap.addUser(userFromStore)
        } else if (!failedUserParams.has(userId)) {
          idsToRequestAPI.push(userId)
        }
      }
      if (idsToRequestAPI.length === 1) {
        const requestedUser = await TwitterAPI.getSingleUserById(
          idsToRequestAPI[0]
        ).catch(errorHandler(idsToRequestAPI))
        if (requestedUser) {
          StoreUpdater.insertSingleUserIntoStore(requestedUser)
          userMap.addUser(requestedUser)
        }
      } else if (idsToRequestAPI.length > 1) {
        const requestedUsers = await TwitterAPI.getMultipleUsersById(
          idsToRequestAPI
        )
          .then(users => TwitterUserMap.fromUsersArray(users))
          .catch(errorHandler(idsToRequestAPI))
        if (requestedUsers) {
          StoreUpdater.insertMultipleUsersIntoStore(requestedUsers)
          requestedUsers.forEach(rUser => userMap.addUser(rUser))
        }
      }
      return userMap
    }
  }
}
