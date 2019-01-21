interface ReflectionOptions {
  user: TwitterUser
  indicateBlock: () => void
  indicateReflection: () => void
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
