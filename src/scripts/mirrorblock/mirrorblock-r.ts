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
  export function reflectBlockOnVisible(
    elem: HTMLElement,
    reflOptions: ReflectionOptions
  ) {
    const intob = new IntersectionObserver((entries, observer) => {
      const execute = () => reflectBlock(reflOptions)
      const visibleEntries = entries.filter(ent => ent.isIntersecting)
      for (const ent of visibleEntries) {
        observer.unobserve(ent.target)
        if ('requestIdleCallback' in window) {
          requestIdleCallback(execute, {
            timeout: 1000,
          })
        } else {
          execute()
        }
      }
    })
    intob.observe(elem)
  }
}
