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
    switch (type) {
      case BadgeType.BlocksYou:
        badgeClasses = 'badge blocks-you'
        badgeText = '나를 차단함'
        if (userName.length > 0) {
          badgeText += ` @(${userName})`
        }
        break
      case BadgeType.BlockReflected:
        badgeClasses = 'badge block-reflected'
        badgeText = '차단반사 발동!'
        break
    }
    const shadowRoot = badge.attachShadow({ mode: 'closed' })
    shadowRoot.innerHTML = `\
  <span class="${badgeClasses}">${badgeText}</span>
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
}
