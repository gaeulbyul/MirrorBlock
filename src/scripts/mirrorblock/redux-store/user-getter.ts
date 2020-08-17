import { TwitterUserMap, isTwitterUser } from '../../common'
import * as TwitterAPI from '../../twitter-api-ct'
import * as StoreRetriever from './retriever'
import * as StoreUpdater from './updater'

// API호출 실패한 사용자이름을 저장하여 API호출을 반복하지 않도록 한다.
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
    return userFromStore
  } else if (useAPI) {
    const user = await TwitterAPI.getSingleUserById(userId).catch(treatAsNonExistUser([userId]))
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
  if (notExistUsers.has(loweredName)) {
    return null
  }
  const userFromStore = await StoreRetriever.getUserByName(loweredName)
  if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
    return userFromStore
  } else if (useAPI) {
    const user = await TwitterAPI.getSingleUserByName(userName).catch(
      treatAsNonExistUser([userName])
    )
    if (user) {
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
  const userMap = new TwitterUserMap()
  const idsToRequestAPI: string[] = []
  for (const userId of userIds) {
    const userFromStore = await StoreRetriever.getUserById(userId)
    if (userFromStore && checkObjectIsUser(userFromStore, 3)) {
      userMap.addUser(userFromStore)
    } else if (!notExistUsers.has(userId)) {
      idsToRequestAPI.push(userId)
    }
  }
  if (idsToRequestAPI.length === 1) {
    const requestedUser = await TwitterAPI.getSingleUserById(idsToRequestAPI[0]).catch(
      treatAsNonExistUser(idsToRequestAPI)
    )
    if (requestedUser) {
      StoreUpdater.insertSingleUserIntoStore(requestedUser)
      userMap.addUser(requestedUser)
    }
  } else if (idsToRequestAPI.length > 1) {
    const requestedUsers = await TwitterAPI.getMultipleUsersById(idsToRequestAPI)
      .then(users => TwitterUserMap.fromUsersArray(users))
      .catch(treatAsNonExistUser(idsToRequestAPI))
    if (requestedUsers) {
      StoreUpdater.insertMultipleUsersIntoStore(requestedUsers)
      requestedUsers.forEach(rUser => userMap.addUser(rUser))
    }
  }
  return userMap
}
