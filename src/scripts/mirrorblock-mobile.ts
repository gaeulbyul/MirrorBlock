/// <reference path="./twitter-api.ts" />
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
    const now = Date.now()
    if (item.timestamp + this.expireSpan > now) {
      return item.user
    } else {
      return this.getUserById(userId, true)
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
    const now = Date.now()
    if (item.timestamp + this.expireSpan > now) {
      return item.user
    } else {
      return this.getUserByName(userName, true)
    }
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
  async function timelineTweetHandler(elem: HTMLElement) {
    const tweetTimeElem = elem.querySelector('time')
    if (!tweetTimeElem) {
      throw new Error('unreachable')
    }
    const tweetPermalink = tweetTimeElem.closest('a')!
    // 원 트윗 작성자의 유저네임과
    const userNameOfPermalinkTweet = getUserNameFromTweetUrl(tweetPermalink)
    if (!userNameOfPermalinkTweet) {
      throw new Error('unreachable')
    }
    const tweetLinks = Array.from(
      elem.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')
    )
      .filter(el => {
        return (
          el.hostname === 'twitter.com' || el.hostname === 'mobile.twitter.com'
        )
      })
      .filter(el => {
        // 트윗 링크에서 작성자 유저네임을 가져왔는데
        const userNameOfTargetTweet = getUserNameFromTweetUrl(el)!
        // 그 이름이 서로 다를 경우
        const isDifferentName =
          userNameOfPermalinkTweet !== userNameOfTargetTweet
        // (원 작성자가 아닌) 다른 사람이 작성한 트윗이라고 판단한다
        return isDifferentName
      })
    const promises = tweetLinks.map(async tweetLink => {
      const userName = getUserNameFromTweetUrl(tweetLink)
      if (!userName) {
        return
      }
      const user = await cachedRetriever
        .getUserByName(userName)
        .catch(() => null)
      if (!user) {
        return
      }
      return reflectBlock({
        user,
        indicateBlock() {
          tweetLink.classList.add('mob-blocks-you-outline') // TODO: 클래스는 붙는데 테두리는 적용이 안 됨.
          tweetLink.parentElement!.appendChild(
            generateBlocksYouBadge(`(@${user.screen_name})`)
          )
        },
        indicateReflection() {
          tweetLink.parentElement!.appendChild(generateBlockReflectedBadge())
        },
      })
    })
    await Promise.all(promises)
  }
  async function detailTweetHandler(elem: HTMLElement) {
    return timelineTweetHandler(elem)
    //
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
      const tweetElem = elem.querySelectorAll<HTMLElement>(
        'div[data-testid="tweet"]'
      )
      tweetElem.forEach(timelineTweetHandler)
      const tweetDetailElem = elem.querySelectorAll<HTMLElement>(
        'div[data-testid="tweetDetail"]'
      )
      tweetDetailElem.forEach(detailTweetHandler)
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
})()
