interface CachedUserItem {
  user: TwitterUser
  timestamp: number
}
class CachedUserRetriever {
  private cachedUsersMap = new Map<string, CachedUserItem>()
  constructor(private expireSpan: number) {}
  private nameAsKey(name: string): string {
    return name.replace(/^@*/, '@')
  }
  private updateUser(user: TwitterUser) {
    const item = {
      user,
      timestamp: Date.now(),
    }
    const nameKey = this.nameAsKey(user.screen_name)
    this.cachedUsersMap.set(user.id_str, item)
    this.cachedUsersMap.set(nameKey, item)
  }
  private isExpired(item: CachedUserItem): boolean {
    return item.timestamp + this.expireSpan < Date.now()
  }
  public async getUserById(
    userId: string,
    forceNew = false
  ): Promise<TwitterUser> {
    if (forceNew || !this.cachedUsersMap.has(userId)) {
      const freshUser = await TwitterAPI.getSingleUserById(userId)
      this.updateUser(freshUser)
      return freshUser
    }
    const item = this.cachedUsersMap.get(userId)!
    if (this.isExpired(item)) {
      return this.getUserById(userId, true)
    } else {
      return item.user
    }
  }
  public async getUserByName(
    userName: string,
    forceNew = false
  ): Promise<TwitterUser> {
    const nameKey = this.nameAsKey(userName)
    if (forceNew || !this.cachedUsersMap.has(nameKey)) {
      const freshUser = await TwitterAPI.getSingleUserByName(userName)
      this.updateUser(freshUser)
      return freshUser
    }
    const item = this.cachedUsersMap.get(nameKey)!
    if (this.isExpired(item)) {
      return this.getUserByName(userName, true)
    } else {
      return item.user
    }
  }
  public async getMultipleUsersByName(
    userNames: string[],
    forceNew = false
  ): Promise<TwitterUser[]> {
    const users: TwitterUser[] = []
    const namesThatShouldFetch: string[] = []
    for (const name of userNames) {
      const namekey = this.nameAsKey(name)
      if (this.cachedUsersMap.has(namekey)) {
        const item = this.cachedUsersMap.get(namekey)!
        if (forceNew || this.isExpired(item)) {
          namesThatShouldFetch.push(name)
        } else {
          users.push(item.user)
        }
      } else {
        namesThatShouldFetch.push(name)
      }
    }
    const freshUsers = await TwitterAPI.getMultipleUsersByName(
      namesThatShouldFetch
    )
    users.push(...freshUsers)
    freshUsers.forEach(this.updateUser.bind(this))
    return users
  }
  public clearCache(): void {
    this.cachedUsersMap.clear()
  }
}
;(() => {
  const reactRoot = document.getElementById('react-root')
  if (!reactRoot) {
    return
  }
  const cachedRetriever = new CachedUserRetriever(1000 * 60 * 5)
  function getUserNameFromTweetUrl(
    extractMe: HTMLAnchorElement | URL | Location
  ): string | null {
    const pathname = extractMe.pathname
    const matches = /^\/([0-9a-z_]+)/i.exec(pathname)
    return matches ? matches[1] : null
  }
  async function tweetHandler(tweetElem: HTMLElement) {
    const tweetLinks = Array.from(
      tweetElem.querySelectorAll<HTMLAnchorElement>(
        'a[href^="/"][href*="/status/"]'
      )
    )
    for (const link of tweetLinks) {
      const tweetAuthorName = getUserNameFromTweetUrl(link)
      if (!tweetAuthorName) {
        continue
      }
      const tweetAuthor = await cachedRetriever.getUserByName(tweetAuthorName)
      await reflectBlock({
        user: tweetAuthor,
        indicateBlock() {
          link.classList.add('mob-blocks-you-outline')
          const parentElem = link.parentElement!
          MirrorBlock.Badge.appendBlocksYouBadge(parentElem)
        },
        indicateReflection() {
          link.classList.add('mob-blocks-you-outline')
          const parentElem = link.parentElement!
          MirrorBlock.Badge.appendBlockReflectedBadge(parentElem)
        },
      })
    }
  }
  async function reflectOnProfile(helpLink: Element) {
    const userName = getUserNameFromTweetUrl(location)
    if (!userName) {
      return
    }
    const user = await cachedRetriever.getUserByName(userName)
    if (!user) {
      return
    }
    reflectBlock({
      user,
      indicateBlock() {
        MirrorBlock.Badge.appendBlocksYouBadge(helpLink.parentElement!)
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
        MirrorBlock.Badge.appendBlockReflectedBadge(helpLink.parentElement!)
      },
    })
  }
  function extractElems(elem: Document | HTMLElement): HTMLElement[] {
    const blockedMeHelpLink = elem.querySelector(
      'a[href="https://support.twitter.com/articles/20172060"]'
    )
    if (blockedMeHelpLink) {
      reflectOnProfile(blockedMeHelpLink)
    }
    const tweetElem = elem.querySelectorAll<HTMLElement>(
      '[data-testid="tweet"]'
    )
    const tweetDetailElem = elem.querySelectorAll<HTMLElement>(
      '[data-testid="tweetDetail"]'
    )
    return [...tweetElem, ...tweetDetailElem]
      .filter(elem => !elem.classList.contains('mob-checked'))
      .map(elem => {
        elem.classList.add('mob-checked')
        return elem
      })
  }
  new MutationObserver(mutations => {
    for (const elem of getAddedElementsFromMutations(mutations)) {
      extractElems(elem).forEach(tweetHandler)
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
  extractElems(document).forEach(tweetHandler)
})()
