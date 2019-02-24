namespace MirrorBlock.Options {
  const defaults = Object.freeze<MirrorBlockOption>({
    outlineBlockUser: false,
    enableBlockReflection: false,
    blockMutedUser: false,
    alwaysImmediatelyBlockMode: false,
    noDelay: false,
  })
  export async function save(newOption: MirrorBlockOption) {
    const option = Object.assign<
      object,
      MirrorBlockOption,
      Partial<MirrorBlockOption>
    >({}, defaults, newOption)
    return browser.storage.local.set({
      option,
    })
  }
  export async function load(): Promise<MirrorBlockOption> {
    const loaded = await browser.storage.local.get('option')
    return Object.assign<object, MirrorBlockOption, any>(
      {},
      defaults,
      loaded.option
    )
  }
}
