/// <reference path="./twitter-api.ts" />

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
    const targetUser = await TwitterAPI.getSingleUserByName(userName)
    if (targetUser.blocked_by) {
      const options = await ExtOption.load()
      const userBadges = header.querySelector('.UserBadges')!
      userBadges.appendChild(generateBlocksYouBadge())
      const muteSkip = targetUser.muting && !options.blockMutedUser
      const shouldBlock = options.enableBlockReflection && !muteSkip
      if (shouldBlock) {
        const blockResult = await TwitterAPI.blockUser(targetUser).catch(
          err => {
            console.error(err)
            return false
          }
        )
        if (blockResult) {
          userBadges.appendChild(generateBlockReflectedBadge())
        }
      }
    }
  }
  const dmObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes') {
        continue
      }
      const targetElem = mutation.target as HTMLElement
      const isReadonly = targetElem.classList.contains('is-readonly')
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
