{
  async function handleDM(elem: HTMLElement) {
    const header = elem.querySelector('#dm_dialog-header')
    if (!header) {
      return
    }
    const profileLink = header.querySelector<HTMLAnchorElement>(
      'a.js-user-profile-link'
    )
    const userName = profileLink!.pathname.replace(/^\//, '')
    const targetUser = await TwitterAPI.getSingleUserByName(userName).catch(
      () => null
    )
    if (!targetUser) {
      return
    }
    const userBadges = header.querySelector('.UserBadges')!
    const badge = new MirrorBlock.Badge.Badge()
    MirrorBlock.Reflection.reflectBlock({
      user: targetUser,
      indicateBlock() {
        badge.appendTo(userBadges)
      },
      indicateReflection() {
        badge.blockReflected()
      },
    })
  }
  const dmObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes') {
        continue
      }
      const targetElem = mutation.target as HTMLElement
      const isReadonly = targetElem.classList.contains('is-readonly')
      if (targetElem.classList.contains('mob-checked')) {
        return
      }
      targetElem.classList.add('mob-checked')
      if (isReadonly) {
        handleDM(targetElem)
      }
    }
  })
  if (!document.getElementById('react-root')) {
    const dmConv = document.querySelector('.DMConversation')
    if (dmConv) {
      dmObserver.observe(dmConv, {
        attributeFilter: ['class'],
        attributes: true,
      })
    }
  }
}
