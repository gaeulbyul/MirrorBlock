/// <reference path="./twitter-api.ts" />
;(() => {
  const reactRoot = document.getElementById('react-root')
  if (!reactRoot) {
    return
  }
  const userCache = new Map<string, TwitterUser>()
  async function getUserByName(name: string): Promise<TwitterUser | null> {
    let user = userCache.get(name) || null
    if (user) {
      return user
    }
    user = await TwitterAPI.getSingleUserByName(name).catch(() => null)
    if (user) {
      userCache.set(name, user)
    }
    return user
  }
  async function reflectOnProfile(helpLink: Element) {
    const matches = /^\/(?<user_name>[0-9a-z_]+)/i.exec(location.pathname)
    if (!matches || !matches.groups || !matches.groups.user_name) {
      return
    }
    const userName = matches.groups.user_name
    const user = await getUserByName(userName)
    if (!user) {
      return
    }
    reflectBlock({
      user,
      indicateBlock() {
        helpLink.parentElement!.appendChild(generateBlocksYouBadge())
        const profileImage = document.querySelector(
          `a[href$="/${user.screen_name}/photo"] img[src*="/profile_images/"]`
        )
        if (profileImage) {
          const shouldOutline = profileImage.closest('a[href$="photo"]')!
            .firstElementChild!
          shouldOutline.classList.add('mob-blocks-you-outline')
        }
      },
      indicateReflection() {
        helpLink.parentElement!.appendChild(generateBlockReflectedBadge())
      },
    })
  }
  new MutationObserver(mutations => {
    for (const elem of getAddedElementsFromMutations(mutations)) {
      const blockedMeHelpLink = elem.querySelector(
        'a[href="https://support.twitter.com/articles/20172060"]'
      )
      if (blockedMeHelpLink) {
        reflectOnProfile(blockedMeHelpLink)
      }
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
})()
