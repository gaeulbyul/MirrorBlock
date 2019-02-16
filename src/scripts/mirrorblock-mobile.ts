declare function cloneInto<T>(detail: T, view: Window | null): T
;(() => {
  const reactRoot = document.getElementById('react-root')
  if (!reactRoot) {
    return
  }
  injectScript('scripts/twitter-inject.js')
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
  }
  const reduxedStore = new ReduxedStore()
  async function getUserByName(userName: string): Promise<TwitterUser> {
    return (
      (await reduxedStore.getUserByName(userName)) ||
      (await TwitterAPI.getSingleUserByName(userName))
    )
  }

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
      const tweetAuthor = await getUserByName(tweetAuthorName)
      await MirrorBlock.Reflection.reflectBlock({
        user: tweetAuthor!,
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
  async function reflectOnProfile() {
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
      reflectOnProfile()
      extractElems(elem).forEach(tweetHandler)
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
  reflectOnProfile()
  extractElems(document).forEach(tweetHandler)
})()
