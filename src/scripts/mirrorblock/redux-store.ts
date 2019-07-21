namespace MirrorBlock.Mobile.Redux {
  const tweetMap = new Map<string, Tweet>()
  const userMapById = new Map<string, TwitterUser>()
  const userMapByName = new Map<string, TwitterUser>()
  const conversationMap = new Map<string, DMData>()
  export namespace StoreRetriever {
    export function getUserByName(userName: string): TwitterUser | null {
      const loweredName = userName.toLowerCase()
      return userMapByName.get(loweredName) || null
    }
    export function getUserById(userId: string): TwitterUser | null {
      return userMapById.get(userId) || null
    }
    export function getTweet(tweetId: string): Tweet | null {
      return tweetMap.get(tweetId) || null
    }
    export function getDMData(convId: string): DMData | null {
      return conversationMap.get(convId) || null
    }
    export function subcribeEvent() {
      document.addEventListener('MirrorBlock<-subscribe', event => {
        const customEvent = event as CustomEvent<SubscribedEntities>
        const { users, tweets, conversations } = customEvent.detail
        // Object.entries는 꽤 느리더라.
        // 따라서, Object.keys로 대체함
        // https://bugs.chromium.org/p/v8/issues/detail?id=6804
        for (const userId of Object.keys(users)) {
          const user = users[userId]
          const loweredName = user.screen_name.toLowerCase()
          userMapById.set(userId, user)
          userMapByName.set(loweredName, user)
        }
        for (const tweetId of Object.keys(tweets)) {
          const tweet = tweets[tweetId]
          tweetMap.set(tweetId, tweet)
        }
        if (conversations) {
          for (const convId of Object.keys(conversations)) {
            const convData = conversations[convId]
            conversationMap.set(convId, convData.data)
          }
        }
      })
    }
  }
  export namespace StoreUpdater {
    // 파이어폭스에서 CustomEvent의 detail 개체 전달용
    function cloneDetail<T>(detail: T): T {
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
  export namespace UserGetter {
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
    function checkObjectKeys(obj: object | null, n: number): boolean {
      if (!obj) {
        return false
      }
      const keys = Object.keys(obj)
      return keys.length > n
    }
    export async function getUserById(
      userId: string,
      useAPI: boolean
    ): Promise<TwitterUser | null> {
      if (failedUserParams.has(userId)) {
        return null
      }
      const userFromStore = StoreRetriever.getUserById(userId)
      if (userFromStore && checkObjectKeys(userFromStore, 3)) {
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
      const userFromStore = StoreRetriever.getUserByName(loweredName)
      if (userFromStore && checkObjectKeys(userFromStore, 3)) {
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
        const userFromStore = StoreRetriever.getUserById(userId)
        if (userFromStore && checkObjectKeys(userFromStore, 3)) {
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
