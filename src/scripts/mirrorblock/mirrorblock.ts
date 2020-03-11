import * as Options from '../../extoption'
import { getAddedElementsFromMutations } from '../common'
import * as TwitterAPI from '../twitter-api-ct'
import Badge from './mirrorblock-badge'

interface IFoundTarget {
  selector: string
  elem: HTMLElement
  alreadyBlocked: boolean
  blocksYou: boolean
  muted: boolean
  userId: string
  badgeElem: Element
  addOutlineClassName: () => void
  afterBlockReflect?: () => void
}

interface FoundTargetJAU extends IFoundTarget {
  selector: '.js-actionable-user'
}

interface FoundTargetProfile extends IFoundTarget {
  selector: '.ProfileNav'
}

type FoundTarget = FoundTargetJAU | FoundTargetProfile

function transformJAU(elem: HTMLElement): FoundTargetJAU {
  // dummy elem
  let badgeElem = document.createElement('div') as HTMLElement
  const cardUserName = elem.querySelector<HTMLElement>(
    '.ProfileCard-screenname'
  )
  // 리스트나 차단/뮤트목록의 항목
  const itemContent = elem.querySelector<HTMLElement>('.content')
  if (cardUserName) {
    badgeElem = cardUserName
  }
  if (itemContent) {
    badgeElem = itemContent
  }
  return {
    selector: '.js-actionable-user',
    elem,
    alreadyBlocked: elem.querySelector('.blocked') !== null,
    muted: elem.querySelector('.muting') !== null,
    blocksYou: elem.querySelector('.blocks-you') !== null,
    userId: elem.getAttribute('data-user-id')!,
    badgeElem,
    addOutlineClassName() {
      elem.classList.add('mob-blocks-you-outline')
    },
    afterBlockReflect() {
      const actions = elem.querySelector('.user-actions')
      if (actions) {
        actions.classList.remove('not-following')
        actions.classList.add('blocked')
      }
    },
  }
}

function transformProfile(elem: HTMLElement): FoundTargetProfile {
  return {
    selector: '.ProfileNav',
    elem,
    alreadyBlocked: elem.querySelector('.blocked') !== null,
    muted: elem.querySelector('.muting') !== null,
    blocksYou: elem.querySelector('.blocks-you') !== null,
    userId: elem.getAttribute('data-user-id')!,
    badgeElem: document.querySelector('.ProfileHeaderCard-screenname')!,
    addOutlineClassName() {
      const avatar = document.querySelector('.ProfileAvatar')
      if (avatar) {
        avatar.classList.add('mob-blocks-you-outline')
      }
    },
    afterBlockReflect() {
      const actions = elem.querySelector('.user-actions')
      if (actions) {
        actions.classList.remove('not-following')
        actions.classList.add('blocked')
      }
      const profileActionsElem = elem.querySelector(
        '.ProfileNav-item--userActions'
      )
      if (profileActionsElem) {
        profileActionsElem.classList.add('profile-blocks-you')
      }
    },
  }
}

async function blockReflectionToFt(ft: FoundTarget): Promise<boolean> {
  const result = await TwitterAPI.blockUserById(ft.userId)
  if (result) {
    if (typeof ft.afterBlockReflect === 'function') {
      ft.afterBlockReflect()
    }
  }
  return result
}

async function foundTargetHandler(ft: FoundTarget): Promise<void> {
  ft.addOutlineClassName()
  const badge = new Badge()
  badge.appendTo(ft.badgeElem)
  const options = await Options.load()
  const muteSkip = ft.muted && !options.blockMutedUser
  const shouldBlock =
    options.enableBlockReflection && !ft.alreadyBlocked && !muteSkip
  if (shouldBlock) {
    const blockResult = await blockReflectionToFt(ft)
    if (blockResult) {
      badge.blockReflected()
    }
  }
}

function extractJAUElems(node: Document | HTMLElement): FoundTargetJAU[] {
  const nodelist = node.querySelectorAll<HTMLElement>('.js-actionable-user')
  const result = Array.from(nodelist).map(transformJAU)
  if (node instanceof HTMLElement && node.matches('.js-actionable-user')) {
    result.push(transformJAU(node))
  }
  return result
}

function checkTargetElems(fts: FoundTarget[]): FoundTarget[] {
  return fts
    .filter(ft => !ft.elem.classList.contains('mob-checked'))
    .map(ft => (ft.elem.classList.add('mob-checked'), ft))
    .filter(ft => ft.blocksYou)
    .map(ft => (ft.elem.classList.add('mob-blocks-you'), ft))
}

function extractTargetElems(node: Document | HTMLElement): FoundTarget[] {
  const foundTargetElems: FoundTarget[] = []
  foundTargetElems.push(...extractJAUElems(node))
  const profileNav = document.querySelector<HTMLElement>('.ProfileNav')
  if (profileNav) {
    foundTargetElems.push(transformProfile(profileNav))
  }
  return checkTargetElems(foundTargetElems)
}

function applyToRendered() {
  extractTargetElems(document).forEach(foundTargetHandler)
}

export function detectOnLegacyTwitter() {
  const observer = new MutationObserver(mutations => {
    Array.from(getAddedElementsFromMutations(mutations))
      .map(elem => extractTargetElems(elem))
      .forEach(fts => {
        fts.forEach(foundTargetHandler)
      })
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
  applyToRendered()
}
