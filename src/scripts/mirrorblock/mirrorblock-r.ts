import * as Options from '미러블락/extoption'

import { type TwitterUser, TwClient } from '미러블락/scripts/api/twitter-api'
import Badge from './mirrorblock-badge'

interface ReflectionOptions {
  user: TwitterUser
  indicateBlock(badge: Badge): void
  indicateReflection(badge: Badge): void
  passBlockedBy?: boolean
}

export async function reflectBlock({
  user,
  indicateBlock,
  indicateReflection,
  passBlockedBy,
}: ReflectionOptions): Promise<void> {
  console.info('rB: initial user %o', user)
  const twClient = new TwClient()
  // Redux store에서 꺼내온 유저 개체에 blocked_by가 빠져있는 경우가 있더라.
  if (typeof user.blocked_by !== 'boolean' && !passBlockedBy) {
    const userFromAPI = await twClient.getSingleUserById(user.id_str)
    console.info('rB: from API %o', userFromAPI)
    return reflectBlock({
      user: userFromAPI,
      indicateBlock,
      indicateReflection,
      passBlockedBy: true,
    })
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
    const blockResult = await twClient.safelyBlockUser(user).catch(err => {
      console.error(err)
      return false
    })
    if (blockResult) {
      indicateReflection(badge)
    }
  }
}
