export default class Badge {
  private readonly badgedAttr = 'data-mirrorblock-badged'
  private readonly baseElem = document.createElement('span')
  constructor(private user: TwitterUser) {
    let userName = user.screen_name
    const tooltipUserName = userName ? `@${userName}` : '이 사용자'
    this.baseElem.className = 'mob-badge'
    this.baseElem.style.whiteSpace = 'initial'
    this.baseElem.innerHTML = `\
<span class="badge-wrapper">
  <span class="badge blocks-you"
  title="나를 차단함: ${tooltipUserName}이(가) 나를 차단하고 있습니다.">
    나를 차단함
    <span hidden class="badge-username"></span>
  </span>
  <span hidden class="badge block-reflected"
  title="차단반사 발동: Mirror Block이 ${tooltipUserName}을(를) 맞차단했습니다.">
    차단반사 발동!
  </span>
</span>`
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
