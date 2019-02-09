{
  // 보이지 않는 인용트윗은 트위터에서 내부적으로 Tombstone이란 클래스네임이 붙는다.
  async function tombstoneHandler(ts: HTMLElement): Promise<void> {
    const parent = ts.parentElement
    if (!parent) {
      return
    }
    if (ts.classList.contains('mob-checked')) {
      return
    }
    ts.classList.add('mob-checked')
    const links = parent.querySelectorAll<HTMLAnchorElement>(
      'a[data-expanded-url^="https://twitter.com/"]'
    )
    for (const link of links) {
      const realUrl = new URL(link.getAttribute('data-expanded-url')!)
      const userName = realUrl.pathname.split('/')[1]
      const targetUser = await TwitterAPI.getSingleUserByName(userName).catch(
        () => null
      )
      if (!targetUser) {
        return
      }
      MirrorBlock.Reflection.reflectBlock({
        user: targetUser,
        indicateBlock() {
          MirrorBlock.Badge.appendBlocksYouBadge(ts, targetUser.screen_name)
          ts.classList.add('mob-blocks-you-outline')
        },
        indicateReflection() {
          MirrorBlock.Badge.appendBlockReflectedBadge(ts)
        },
      })
    }
  }
  function applyToRendered() {
    document
      .querySelectorAll<HTMLElement>('.Tombstone')
      .forEach(tombstoneHandler)
  }
  const observer = new MutationObserver(() => {
    applyToRendered()
  })
  if (!document.getElementById('react-root')) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    applyToRendered()
  }
}
