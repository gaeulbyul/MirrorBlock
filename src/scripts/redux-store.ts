namespace MirrorBlock.Mobile.Redux {
  type SubscribedEntities = {
    users: TwitterUserEntities
    tweets: TweetEntities
  }
  const tweetMap = new Map<string, Tweet>()
  const userMapById = new Map<string, TwitterUser>()
  const userMapByName = new Map<string, TwitterUser>()
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
    function triggerPageEvent(eventName: string, eventDetail?: object): void {
      const detail = cloneDetail(eventDetail)
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      document.dispatchEvent(requestEvent)
    }
    export async function insertUserIntoStore(
      user: TwitterUser
    ): Promise<void> {
      userMapByName.set(user.screen_name, user)
      triggerPageEvent('insertUserIntoStore', {
        user,
      })
    }
    export async function afterBlockUser(user: TwitterUser): Promise<void> {
      triggerPageEvent('afterBlockUser', {
        user,
      })
      const clonedUser = Object.assign({}, user)
      clonedUser.blocking = true
      insertUserIntoStore(clonedUser)
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
          StoreUpdater.insertUserIntoStore(user)
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
          StoreUpdater.insertUserIntoStore(user)
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
          continue
        }
        idsToRequestAPI.push(userId)
      }
      const usersFromAPI = await TwitterAPI.getMultipleUsersById(
        idsToRequestAPI
      )
      for (const apiUser of usersFromAPI) {
        userMap.addUser(apiUser)
        StoreUpdater.insertUserIntoStore(apiUser)
      }
      return userMap
    }
  }
}
