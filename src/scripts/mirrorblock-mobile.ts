declare function cloneInto<T>(detail: T, view: Window | null): T
const userNamePattern = /^@[0-9a-z_]{1,15}$/i
namespace MirrorBlock.Mobile {
  class ReduxedStore {
    private cloneDetail<T>(detail: T): T {
      if (typeof detail !== 'object') {
        return detail
      }
      if (typeof cloneInto === 'function') {
        return cloneInto(detail, document.defaultView)
      } else {
        return detail
      }
    }
    private async triggerPageEvent<T>(
      eventName: string,
      eventDetail?: object
    ): Promise<T> {
      const nonce = Math.random()
      const detail = this.cloneDetail(
        Object.assign({}, eventDetail, {
          nonce,
        })
      )
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject('timeouted!')
        }, 10000)
        document.addEventListener(
          `MirrorBlock<-${eventName}.${nonce}`,
          event => {
            window.clearTimeout(timeout)
            const customEvent = event as CustomEvent
            resolve(customEvent.detail)
          },
          { once: true }
        )
        document.dispatchEvent(requestEvent)
      })
    }
    public async getWholeState(): Promise<any> {
      // for debugging
      return this.triggerPageEvent('getWholeState')
    }
    public async getUserByName(userName: string): Promise<TwitterUser | null> {
      const result = await this.triggerPageEvent<TwitterUser>('getUserByName', {
        userName,
      })
      return result || null
    }
    public async insertUserIntoStore(user: TwitterUser): Promise<void> {
      this.triggerPageEvent('inserUserIntoStore', {
        user,
      })
    }
    public async fetchAndInsertByName(userName: string): Promise<TwitterUser> {
      const user = await TwitterAPI.getSingleUserByName(userName)
      this.insertUserIntoStore(user)
      return user
    }
  }
  const reduxedStore = new ReduxedStore()
  async function getUserByName(userName: string): Promise<TwitterUser> {
    const userFromStore = await reduxedStore.getUserByName(userName)
    if (userFromStore) {
      return userFromStore
    } else {
      console.debug('request api "@%s"', userName)
      return reduxedStore.fetchAndInsertByName(userName)
    }
  }
  function markOutline(elem: Element | null): void {
    if (elem) {
      elem.setAttribute('data-mirrorblock-blocks-you', '1')
    }
  }
  function getUserNameFromTweetUrl(
    extractMe: HTMLAnchorElement | URL | Location
  ): string | null {
    const pathname = extractMe.pathname
    const matches = /^\/([0-9a-z_]{1,15})/i.exec(pathname)
    return matches ? matches[1] : null
  }
  const tweetLinkObserver = new IntersectionObserver(
    async (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }
        const link = entry.target
        observer.unobserve(link)
        if (!(link instanceof HTMLAnchorElement)) {
          continue
        }
        const tweetAuthorName = getUserNameFromTweetUrl(link)
        if (!tweetAuthorName) {
          continue
        }
        const tweetAuthor = await getUserByName(tweetAuthorName)
        await MirrorBlock.Reflection.reflectBlock({
          user: tweetAuthor!,
          indicateBlock() {
            markOutline(link)
            MirrorBlock.Badge.insertBlocksYouBadgeAfter(link)
          },
          indicateReflection() {
            MirrorBlock.Badge.insertBlockReflectedBadgeAfter(link)
          },
        })
      }
    },
    {
      rootMargin: '10px',
    }
  )
  const userCellObserver = new IntersectionObserver(
    async (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }
        const cell = entry.target as HTMLElement
        observer.unobserve(cell)
        Array.from(cell.querySelectorAll('[dir="ltr"]'))
          .filter(ltr => userNamePattern.test(ltr.textContent || ''))
          .forEach(async ltr => {
            const userName = ltr.textContent!.replace(/^@/, '')
            const user = await getUserByName(userName)
            MirrorBlock.Reflection.reflectBlock({
              user,
              indicateBlock() {
                markOutline(cell)
                MirrorBlock.Badge.insertBlocksYouBadgeAfter(ltr)
              },
              indicateReflection() {
                MirrorBlock.Badge.insertBlockReflectedBadgeAfter(ltr)
              },
            })
          })
      }
    }
  )
  function findLinks(tweetElem: HTMLElement): HTMLAnchorElement[] {
    const result: HTMLAnchorElement[] = []
    const internalLinks = Array.from(
      tweetElem.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
    )
    for (const link of internalLinks) {
      const { pathname, textContent } = link
      if (/^\/[0-9a-z_]{1,15}\/status\/\d+/.test(pathname)) {
        result.push(link)
        continue
      }
      if (textContent && userNamePattern.test(textContent)) {
        result.push(link)
        continue
      }
    }
    return result
  }
  async function detectProfile() {
    const helpLink = document.querySelector(
      'a[href="https://support.twitter.com/articles/20172060"]'
    )
    if (!helpLink) {
      return
    }
    const userName = getUserNameFromTweetUrl(location)
    if (!userName) {
      return
    }
    const user = await getUserByName(userName)
    if (!user) {
      return
    }
    MirrorBlock.Reflection.reflectBlock({
      user,
      indicateBlock() {
        MirrorBlock.Badge.appendBlocksYouBadge(helpLink.parentElement!)
      },
      indicateReflection() {
        MirrorBlock.Badge.appendBlockReflectedBadge(helpLink.parentElement!)
      },
    })
  }
  function detectOnTweetLinks(rootElem: Document | HTMLElement): void {
    const tweetElems = rootElem.querySelectorAll<HTMLElement>(
      '[data-testid="tweet"], [data-testid="tweetDetail"]'
    )
    const filteredTweetElems = filterElements(tweetElems)
    for (const tweet of filteredTweetElems) {
      for (const link of findLinks(tweet)) {
        tweetLinkObserver.observe(link)
      }
    }
  }
  function detectOnUserCell(rootElem: Document | HTMLElement): void {
    const userCellElems = rootElem.querySelectorAll<HTMLElement>(
      '[data-testid="UserCell"]'
    )
    const filteredUserCellElems = filterElements(userCellElems)
    for (const cell of filteredUserCellElems) {
      userCellObserver.observe(cell)
    }
  }
  function detect(rootElem: Document | HTMLElement): void {
    detectOnTweetLinks(rootElem)
    detectOnUserCell(rootElem)
  }
  export async function initialize() {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    await injectScript('scripts/twitter-inject.js')
    new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        detectProfile()
        detect(elem)
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
    detectProfile()
    detect(document)
  }
}

MirrorBlock.Mobile.initialize()
