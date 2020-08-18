import { TwitterUserMap, isTwitterUser } from '../../common'
import * as TwitterAPI from '../../twitter-api-ct'
import * as StoreRetriever from './retriever'
import * as StoreUpdater from './updater'

// Redux store에 들어가기 전에 요청이 들어오는 경우를 대비한 캐시
const userCacheById = new Map<string, TwitterUser>()
const userCacheByName = new Map<string, TwitterUser>()
function addUserToCache(user: TwitterUser) {
  userCacheById.set(user.id_str, user)
  userCacheByName.set(user.screen_name, user)
}

// API호출 실패한 사용자 ID나 사용자이름을 저장하여 API호출을 반복하지 않도록 한다.
// (예: 지워지거나 정지걸린 계정)
const notExistUsers = new Set<string>()

function treatAsNonExistUser(failedIdOrNames: string[]): (err: any) => void {
  return (err: any) => {
    failedIdOrNames.forEach(idOrName => notExistUsers.add(idOrName))
    console.error(err)
  }
}
// 2019-07-08
// reduxStore.dispatch('rweb/BATCH', ...)를 통해 들어온 사용자 정보엔
// id_str 과 screen_name 만 들어있는 경우가 있다.
// 정보값이 불충분하므로 store에 없는 사용자로 취급
function checkObjectIsUser(obj: object | null, n: number): obj is TwitterUser {
  if (!obj) {
    return false
  }
  const keys = Object.keys(obj)
  if (keys.length <= n) {
    return false
  }
  return isTwitterUser(obj)
}
export async function getUserById(userId: string, useAPI: boolean): Promise<TwitterUser | null> {
  if (notExistUsers.has(userId)) {
    return null
  }
  const userFromStore = await StoreRetriever.getUserById(userId)
  if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
    addUserToCache(userFromStore)
    return userFromStore
  } else if (userCacheById.has(userId)) {
    return userCacheById.get(userId)!
  } else if (useAPI) {
    const user = await TwitterAPI.getSingleUserById(userId).catch(treatAsNonExistUser([userId]))
    if (user) {
      addUserToCache(user)
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
  if (notExistUsers.has(loweredName)) {
    return null
  }
  const userFromStore = await StoreRetriever.getUserByName(loweredName)
  if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
    addUserToCache(userFromStore)
    return userFromStore
  } else if (userCacheByName.has(userName)) {
    return userCacheByName.get(userName)!
  } else if (useAPI) {
    const user = await TwitterAPI.getSingleUserByName(userName).catch(
      treatAsNonExistUser([userName])
    )
    if (user) {
      addUserToCache(user)
      StoreUpdater.insertSingleUserIntoStore(user)
    }
    return user || null
  } else {
    return null
  }
}
export async function getMultipleUsersById(userIds: string[]): Promise<TwitterUserMap> {
  if (userIds.length > 100) {
    throw new Error('too many user!')
  }
  const resultUserMap = new TwitterUserMap()
  const idsToRequestAPI: string[] = []
  for (const userId of userIds) {
    const userFromStore = await StoreRetriever.getUserById(userId)
    const userFromCache = userCacheById.get(userId)
    if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
      addUserToCache(userFromStore)
      resultUserMap.addUser(userFromStore)
    } else if (userFromCache) {
      resultUserMap.addUser(userFromCache)
    } else if (!notExistUsers.has(userId)) {
      idsToRequestAPI.push(userId)
    }
  }
  if (idsToRequestAPI.length === 1) {
    const requestedUser = await TwitterAPI.getSingleUserById(idsToRequestAPI[0]).catch(
      treatAsNonExistUser(idsToRequestAPI)
    )
    if (requestedUser) {
      addUserToCache(requestedUser)
      StoreUpdater.insertSingleUserIntoStore(requestedUser)
      resultUserMap.addUser(requestedUser)
    }
  } else if (idsToRequestAPI.length > 1) {
    const requestedUsers = await TwitterAPI.getMultipleUsersById(idsToRequestAPI)
      .then(users => TwitterUserMap.fromUsersArray(users))
      .catch(treatAsNonExistUser(idsToRequestAPI))
    if (requestedUsers) {
      StoreUpdater.insertMultipleUsersIntoStore(requestedUsers)
      requestedUsers.forEach(user => {
        addUserToCache(user)
        resultUserMap.addUser(user)
      })
    }
  }
  return resultUserMap
}
