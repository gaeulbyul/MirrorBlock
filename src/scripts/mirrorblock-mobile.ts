namespace MirrorBlock.Mobile {
  const {
    Utils,
    Badge: { Badge },
    Reflection: { reflectBlock, reflectBlockOnVisible },
    Mobile: {
      Redux: { StoreRetriever, StoreUpdater, UserGetter },
    },
  } = MirrorBlock

  type DOMQueryable = HTMLElement | Document

  function markOutline(elem: Element | null): void {
    if (elem) {
      elem.setAttribute('data-mirrorblock-blocks-you', '1')
    }
  }
  function markOutlineViaCSS(elem: HTMLElement | null): void {
    if (elem) {
      elem.style.border = '2px solid crimson'
    }
  }
  function getElemByEntry(entry: Entry): HTMLElement | null {
    return document.querySelector(
      `[data-mirrorblock-entryid="${entry.entryId}"]`
    )
  }
  namespace ProfileDetector {
    export async function detectProfile(rootElem: DOMQueryable) {
      const helpLinks = rootElem.querySelectorAll<HTMLElement>(
        'a[href="https://support.twitter.com/articles/20172060"]'
      )
      const filteredElems = Utils.filterElements(helpLinks)
      if (filteredElems.length <= 0) {
        return
      }
      const helpLink = filteredElems[0]
      const userName = Utils.getUserNameFromTweetUrl(location)
      if (!userName) {
        return
      }
      // const user = StoreRetriever.getUserByName(userName)
      const user = await TwitterAPI.getSingleUserByName(userName)
      if (!user) {
        return
      }
      const badge = new Badge()
      reflectBlock({
        user,
        indicateBlock() {
          badge.appendTo(helpLink.parentElement!)
        },
        indicateReflection() {
          badge.blockReflected()
          StoreUpdater.afterBlockUser(user)
        },
      })
    }
  }
  namespace EntryHandler {
    async function handleQuotedTweet(tweet: TweetWithQuote, entry: TweetEntry) {
      const qUrlString = tweet.quoted_status_permalink.expanded
      const qUrl = new URL(qUrlString)
      const quotedUserName = Utils.getUserNameFromTweetUrl(qUrl)!
      const quotedUser = await UserGetter.getUserByName(quotedUserName, true)
      if (!quotedUser || !quotedUser.blocked_by) {
        return
      }
      const elem = getElemByEntry(entry)!
      const badge = new Badge()
      badge.showUserName(quotedUser.screen_name)
      const quoteLink = elem.querySelector(`a[href^="${qUrl.pathname}" i]`)!
      reflectBlockOnVisible(elem, {
        user: quotedUser,
        indicateBlock() {
          markOutline(quoteLink)
          badge.attachAfter(quoteLink)
        },
        indicateReflection() {
          badge.blockReflected()
        },
      })
    }
    export async function handleTweet(tweetEntry: TweetEntry) {
      const tweet = StoreRetriever.getTweet(tweetEntry.content.id)!
      if (tweet.is_quote_status) {
        const qtweet = tweet as TweetWithQuote
        handleQuotedTweet(qtweet, tweetEntry)
      }
    }
    export async function handleUser(userEntry: UserEntry) {
      const user = StoreRetriever.getUserById(userEntry.content.id)!
      if (!user.blocked_by) {
        return
      }
      const elem = getElemByEntry(userEntry)!
      const badge = new Badge()
      const badgeTarget = elem.querySelector(
        `a[role=link][href^="/${user.screen_name}" i] [dir=ltr]`
      )
      if (!badgeTarget) {
        throw new Error('unreachable')
      }
      reflectBlockOnVisible(elem, {
        user,
        indicateBlock() {
          markOutline(elem)
          badge.attachAfter(badgeTarget)
        },
        indicateReflection() {
          badge.blockReflected()
        },
      })
    }
    export async function handleTombstone(tombstoneEntry: TombstoneEntry) {
      console.debug(tombstoneEntry)
      const tweetId = tombstoneEntry.content.tweet.id
      const tweet = StoreRetriever.getTweet(tweetId)
      if (!tweet) {
        return
      }
      const user = await UserGetter.getUserById(tweet.user, true)
      if (!user || !user.blocked_by) {
        return
      }
      const elem = getElemByEntry(tombstoneEntry)!
      const badge = new Badge()
      badge.showUserName(user.screen_name)
      const badgeTarget = elem.querySelector('span[dir]')!
      const outlineTarget = badgeTarget.closest('div[dir=auto]')!.parentElement!
      reflectBlockOnVisible(elem, {
        user,
        indicateBlock() {
          markOutlineViaCSS(outlineTarget)
          badge.appendTo(badgeTarget)
        },
        indicateReflection() {
          badge.blockReflected
        },
      })
    }
  }
  function startObserve(reactRoot: HTMLElement): void {
    new MutationObserver(mutations => {
      for (const elem of Utils.getAddedElementsFromMutations(mutations)) {
        ProfileDetector.detectProfile(elem)
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
    // TweetDetector.startTweetItemObserver()
    document.addEventListener('MirrorBlock<-entry', event => {
      const customEvent = event as CustomEvent<Entry>
      const entry = customEvent.detail
      switch (entry.type) {
        case 'tweet': {
          EntryHandler.handleTweet(entry)
          break
        }
        case 'user': {
          EntryHandler.handleUser(entry)
          break
        }
        case 'tombstone': {
          EntryHandler.handleTombstone(entry)
          break
        }
        default: {
          console.debug('entry: %o', entry)
        }
      }
    })
  }
  export async function initialize() {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    // 로그인여부 체크용
    // TODO: API 대신 reduxStore 쓰기?
    // const myself = await TwitterAPI.getMyself().catch(() => null)
    // if (!myself) {
    //   return
    // }
    await Utils.injectScript('vendor/uuid.js')
    await Utils.injectScript('scripts/twitter-inject.js')
    StoreRetriever.subcribeEvent()
    startObserve(reactRoot)
  }
}

MirrorBlock.Mobile.initialize()
