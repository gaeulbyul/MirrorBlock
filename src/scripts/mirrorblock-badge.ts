namespace MirrorBlock.BadgeV2 {
  export class Badge {
    private readonly baseElem = document.createElement('span')
    private readonly shadowRoot = this.baseElem.attachShadow({ mode: 'closed' })
    constructor() {
      const badgeCss = browser.runtime.getURL('styles/mob-badge.css')
      this.baseElem.className = 'mob-badge mob-badge-v2'
      this.baseElem.style.whiteSpace = 'initial'
      this.shadowRoot.innerHTML = `\
<span class="badge-wrapper">
  <span class="badge blocks-you" title="나를 차단함: 이 사용자가 나를 차단하고 있습니다.">
    나를 차단함
    <span hidden class="username" style="font-size:12px"></span>
  </span>
  <span hidden class="badge block-reflected" title="차단반사 발동: Mirror Block이 이 사용자를 맞차단했습니다.">
    차단반사 발동!
  </span>
</span>
<link rel="stylesheet" href="${badgeCss}" />`
    }
    public get element() {
      return this.baseElem
    }
    public showUserName(name: string) {
      const userNameElem = this.shadowRoot.querySelector<HTMLElement>(
        '.username'
      )!
      userNameElem.textContent = `(@${name})`
      userNameElem.hidden = false
    }
    public blockReflected() {
      const brBadge = this.shadowRoot.querySelector<HTMLElement>(
        '.block-reflected[hidden]'
      )!
      brBadge.hidden = false
    }
  }
  export function alreadyExists(elem: HTMLElement): boolean {
    if (elem.querySelector('.mob-badge')) {
      return true
    }
    let nelem = elem.nextElementSibling
    let count = 10
    while (nelem) {
      if (--count <= 10) {
        break
      }
      if (nelem.matches('.mob-badge')) {
        return true
      } else {
        nelem = nelem.nextElementSibling
      }
    }
    return false
  }
}

namespace MirrorBlock.Badge {
  const enum BadgeType {
    BlocksYou = 'blocks-you',
    BlockReflected = 'block-reflected',
  }

  function blocksYouBadge(type: BadgeType, userName = ''): HTMLElement {
    const badgeCss = browser.runtime.getURL('styles/mob-badge.css')
    const badge = document.createElement('span')
    badge.className = `mob-badge mob-badge-${type}`
    let badgeClasses = ''
    let badgeText = ''
    let badgeTooltip = ''
    switch (type) {
      case BadgeType.BlocksYou:
        badgeClasses = 'badge blocks-you'
        badgeText = '나를 차단함'
        badgeTooltip = '나를 차단함: 이 사용자가 나를 차단하고 있습니다.'
        if (userName.length > 0) {
          badgeText += ` (@${userName})`
          badgeTooltip = `나를 차단함: @${userName}님이 나를 차단하고 있습니다.`
        }
        break
      case BadgeType.BlockReflected:
        badgeClasses = 'badge block-reflected'
        badgeText = '차단반사 발동!'
        badgeTooltip =
          '차단반사 발동!: Mirror Block이 이 사용자에게 맞차단을 했습니다.'
        break
    }
    const shadowRoot = badge.attachShadow({ mode: 'closed' })
    shadowRoot.innerHTML = `\
  <span class="${badgeClasses}" title="${badgeTooltip}">${badgeText}</span>
  <link rel="stylesheet" href="${badgeCss}" />`
    return badge
  }

  export function appendBlocksYouBadge(elem: Element, userName = ''): void {
    if (elem.querySelector('.mob-badge-blocks-you')) {
      return
    }
    const badge = blocksYouBadge(BadgeType.BlocksYou, userName)
    elem.appendChild(badge)
  }
  export function appendBlockReflectedBadge(elem: Element): void {
    if (elem.querySelector('.mob-badge-block-reflected')) {
      return
    }
    const badge = blocksYouBadge(BadgeType.BlockReflected)
    elem.appendChild(badge)
  }
  export function insertBlocksYouBadgeAfter(
    elem: Element,
    userName = ''
  ): void {
    const nextElem = elem.nextElementSibling
    if (nextElem && nextElem.matches('.mob-badge-blocks-you')) {
      return
    }
    const badge = blocksYouBadge(BadgeType.BlocksYou, userName)
    elem.after(badge)
  }
  export function insertBlockReflectedBadgeAfter(elem: Element): void {
    const nextElem = elem.nextElementSibling
    if (nextElem && nextElem.matches('.mob-badge-blocks-you')) {
      const nnext = nextElem.nextElementSibling
      if (nnext && nnext.matches('.mob-badge-block-reflected')) {
        return
      }
      const badge = blocksYouBadge(BadgeType.BlockReflected)
      nextElem.after(badge)
    }
  }
}
