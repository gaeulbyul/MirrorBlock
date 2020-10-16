import * as Options from '../../extoption'
import * as TwitterAPI from '../twitter-api-ct'
import Badge from './mirrorblock-badge'

interface ReflectionOptions {
  user: TwitterUser
  indicateBlock: (badge: Badge) => void
  indicateReflection: (badge: Badge) => void
}

export async function reflectBlock({
  user,
  indicateBlock,
  indicateReflection,
}: ReflectionOptions): Promise<void> {
  // Redux store에서 꺼내온 유저 개체에 blocked_by가 빠져있는 경우가 있더라.
  if (typeof user.blocked_by !== 'boolean') {
    const userFromAPI = await TwitterAPI.getSingleUserById(user.id_str)
    if (typeof userFromAPI.blocked_by !== 'boolean') {
      throw new Error('unexpected: still no blocked_by property')
    }
    return reflectBlock({ user: userFromAPI, indicateBlock, indicateReflection })
  }
  if (!user.blocked_by) {
    return
  }
  const badge = new Badge(user)
  indicateBlock(badge)
  const extOptions = await Options.load()
  const muteSkip = user.muting && !extOptions.blockMutedUser
  const shouldBlock = extOptions.enableBlockReflection && !muteSkip && !user.blocking
  if (shouldBlock) {
    const blockResult = await TwitterAPI.blockUser(user).catch(err => {
      console.error(err)
      return false
    })
    if (blockResult) {
      indicateReflection(badge)
    }
  }
}
