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
        const users = Object.entries(customEvent.detail.users)
        const tweets = Object.entries(customEvent.detail.tweets)
        for (const [userId, user] of users) {
          const loweredName = user.screen_name.toLowerCase()
          userMapById.set(userId, user)
          userMapByName.set(loweredName, user)
        }
        for (const [tweetId, tweet] of tweets) {
          tweetMap.set(tweetId, tweet)
        }
        if (customEvent.detail.conversations) {
          const conversations = Object.entries(customEvent.detail.conversations)
          for (const [convId, convData] of conversations) {
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
      document.dispatchEvent(requestEvent)
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
    function errorHandler(failedParam: string): (err: any) => null {
      return (err: any) => {
        failedUserParams.add(failedParam)
        if (err instanceof Response) {
          console.error(err)
        }
        return null
      }
    }
    export async function getUserById(
      userId: string,
      useAPI: boolean
    ): Promise<TwitterUser | null> {
      if (failedUserParams.has(userId)) {
        return null
      }
      const userFromStore = StoreRetriever.getUserById(userId)
      if (userFromStore) {
        return userFromStore
      } else if (useAPI) {
        console.log('request api "%s"', userId)
        const user = await TwitterAPI.getSingleUserById(userId).catch(
          errorHandler(userId)
        )
        if (user) {
          StoreUpdater.insertSingleUserIntoStore(user)
        }
        return user
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
      if (userFromStore) {
        return userFromStore
      } else if (useAPI) {
        console.log('request api "@%s"', userName)
        const user = await TwitterAPI.getSingleUserByName(userName).catch(
          errorHandler(userName)
        )
        if (user) {
          StoreUpdater.insertSingleUserIntoStore(user)
        }
        return user
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
        if (userFromStore) {
          userMap.addUser(userFromStore)
        } else {
          idsToRequestAPI.push(userId)
        }
      }
      if (idsToRequestAPI.length === 1) {
        const requestedUser = await TwitterAPI.getSingleUserById(
          idsToRequestAPI[0]
        ).catch(() => null)
        if (requestedUser) {
          StoreUpdater.insertSingleUserIntoStore(requestedUser)
          userMap.addUser(requestedUser)
        }
      } else if (idsToRequestAPI.length > 1) {
        const requestedUsers = await TwitterAPI.getMultipleUsersById(
          idsToRequestAPI
        )
          .catch((): TwitterUser[] => [])
          .then(users => TwitterUserMap.fromUsersArray(users))
        StoreUpdater.insertMultipleUsersIntoStore(requestedUsers)
        requestedUsers.forEach(rUser => userMap.addUser(rUser))
      }
      return userMap
    }
  }
}
