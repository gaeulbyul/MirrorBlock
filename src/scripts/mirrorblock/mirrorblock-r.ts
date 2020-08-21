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
