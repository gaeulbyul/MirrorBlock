import i18n from '미러블락/scripts/i18n'

export default class Badge {
  private readonly badgedAttr = 'data-mirrorblock-badged'
  private readonly baseElem = document.createElement('span')
  constructor(private user: TwitterUser) {
    const userName = user.screen_name
    this.baseElem.className = 'mob-badge'
    this.baseElem.style.whiteSpace = 'initial'
    this.baseElem.innerHTML = `\
<span class="badge-wrapper">
  <span class="badge blocks-you">
    ${i18n.blocks_you()}
    <span hidden class="badge-username"></span>
  </span>
  <span hidden class="badge block-reflected">
    ${i18n.block_reflected()}
  </span>
</span>`
    this.baseElem
      .querySelector('.badge.blocks-you')!
      .setAttribute('title', i18n.blocks_you_description(userName))
    this.baseElem
      .querySelector('.badge.block-reflected')!
      .setAttribute('title', i18n.block_reflected_description(userName))
  }
  public showUserName() {
    const name = this.user.screen_name
    const userNameElem = this.baseElem.querySelector<HTMLElement>('.badge-username')!
    userNameElem.textContent = `(@${name})`
    userNameElem.hidden = false
  }
  public blockReflected() {
    const brBadge = this.baseElem.querySelector<HTMLElement>('.block-reflected[hidden]')!
    brBadge.hidden = false
  }
  public attachAfter(targetElem: Element): void {
    if (!targetElem.hasAttribute(this.badgedAttr)) {
      targetElem.after(this.baseElem)
      targetElem.setAttribute(this.badgedAttr, '1')
    }
  }
  public appendTo(targetElem: Element): void {
    if (!targetElem.hasAttribute(this.badgedAttr)) {
      targetElem.appendChild(this.baseElem)
      targetElem.setAttribute(this.badgedAttr, '1')
    }
  }
}
