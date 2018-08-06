/* globals browser */

interface MirrorOfBlockOption {
  outlineBlockUser: boolean,
  enableBlockReflection: boolean,
  blockMutedUser: boolean
}

const ExtOption = { // eslint-disable-line no-unused-vars
  defaults: Object.freeze({
    outlineBlockUser: false,
    enableBlockReflection: false,
    blockMutedUser: false
  }),
  async save (newOption: MirrorOfBlockOption) {
    const option = Object.assign({}, this.defaults, newOption)
    return browser.storage.local.set({
      option
    })
  },
  async load (): Promise<MirrorOfBlockOption> {
    const loaded = await browser.storage.local.get('option')
    return Object.assign({}, this.defaults, loaded.option)
  }
}
