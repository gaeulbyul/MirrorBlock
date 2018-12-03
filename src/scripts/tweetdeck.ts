type TDUserDataSet = DOMStringMap & { [i in keyof TDUserData]: string }

interface TDUserData {
  template: string
  id: string
  name: string
  screenName: string
  blocking: boolean
  blockedBy: boolean
  muting: boolean
  following: boolean
  followedBy: boolean
}

function extractUserData(userDataElem: HTMLElement): TDUserData {
  const dataset = userDataElem.dataset as TDUserDataSet
  const toBoolean = (str: string) => str === 'true'
  const result: TDUserData = {
    template: dataset.template,
    id: dataset.id,
    name: dataset.name,
    screenName: dataset.screenName,
    blocking: toBoolean(dataset.blocking),
    blockedBy: toBoolean(dataset.blockedBy),
    muting: toBoolean(dataset.muting),
    following: toBoolean(dataset.following),
    followedBy: toBoolean(dataset.followedBy),
  }
  return result
}

function getMyName(): string {
  let myName = document.body.getAttribute('data-default-account-username')
  myName = myName ? '@' + myName : 'You'
  return myName
}

function makeBlockedBadge(): HTMLElement {
  const myName = getMyName()
  const badge = document.createElement('span')
  badge.className = 'mob-BlockStatus'
  badge.textContent = `Blocks ${myName}`
  return badge
}

function makeBlockReflectedBadge(): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'mob-BlockReflectedStatus'
  badge.textContent = `Block Reflected!`
  return badge
}

function changeFollowButtonToBlocked(elem: Element) {
  const btn = elem.querySelector('.prf-actions .js-action-follow')
  if (!btn) {
    return
  }
  btn.classList.remove('s-not-following')
  btn.classList.add('s-blocking')
}

function findBadgeTarget(elem: HTMLElement): HTMLElement | null {
  let result: HTMLElement | null
  const profileElem = elem.closest('.s-profile.prf')
  if (profileElem) {
    result = profileElem.querySelector('.prf-header p.username')
    if (result) {
      return result
    }
  }
  const previousElement = elem.previousElementSibling as HTMLElement | null
  if (previousElement) {
    if (previousElement.classList.contains('account-summary')) {
      const accElem = previousElement
      result = accElem.querySelector('.username')
      if (result) {
        return result
      }
    }
  }
  return null
}

function userDataHandler(userDataElem: HTMLElement) {
  if (userDataElem.classList.contains('mob-checked')) {
    return
  }
  userDataElem.classList.add('mob-checked')
  const userData = extractUserData(userDataElem)
  if (!userData.blockedBy) {
    return
  }
  let badgeTarget = findBadgeTarget(userDataElem)
  if (!badgeTarget) {
    return
  }
  const badge = makeBlockedBadge()
  badgeTarget.appendChild(badge)
  ExtOption.load().then(option => {
    const muteSkip = userData.muting && !option.blockMutedUser
    const shouldBlock =
      option.enableBlockReflection && !userData.blocking && !muteSkip
    if (shouldBlock) {
      TwitterAPI.blockUserById(userData.id).then(result => {
        if (result) {
          const profileElem = userDataElem.closest('.s-profile.prf')
          if (profileElem) {
            changeFollowButtonToBlocked(profileElem)
          }
          const reflectedBadge = makeBlockReflectedBadge()
          badgeTarget!.appendChild(reflectedBadge)
        }
      })
    }
  })
}

function main() {
  injectScript('scripts/tweetdeck-inject.js')
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue
        }
        const elementsToHandle = [
          ...node.querySelectorAll<HTMLElement>('span.mob-user-data'),
        ]
        if (node.matches('span.mob-user-data')) {
          elementsToHandle.push(node)
        }
        elementsToHandle.forEach(userDataHandler)
      }
    }
  })
  observer.observe(document.body, {
    subtree: true,
    childList: true,
  })
}

main()
