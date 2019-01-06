/// <reference path="../extoption.ts" />
/// <reference path="./twitter-api.ts" />

interface ReflectionOptions {
  user: TwitterUser
  indicateBlock: () => any
  indicateReflection: () => any
}

async function reflectBlock(reflOptions: ReflectionOptions): Promise<void> {
  const { user, indicateBlock, indicateReflection } = reflOptions
  if (!user.blocked_by) {
    return
  }
  indicateBlock()
  const extOptions = await ExtOption.load()
  const muteSkip = user.muting && !extOptions.blockMutedUser
  const shouldBlock =
    extOptions.enableBlockReflection && !muteSkip && !user.blocking
  if (shouldBlock) {
    const blockResult = await TwitterAPI.blockUser(user).catch(err => {
      console.error(err)
      return false
    })
    if (blockResult) {
      indicateReflection()
    }
  }
}
