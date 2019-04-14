namespace MirrorBlock.Reflection {
  interface ReflectionOptions {
    user: TwitterUser
    indicateBlock: () => void
    indicateReflection: () => void
  }

  export async function reflectBlock({
    user,
    indicateBlock,
    indicateReflection,
  }: ReflectionOptions): Promise<void> {
    if (!user.blocked_by) {
      return
    }
    indicateBlock()
    const extOptions = await MirrorBlock.Options.load()
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
}
