/* globals browser */

const ExtOption = { // eslint-disable-line no-unused-vars
  defaults: Object.freeze({
    outlineBlockUser: false,
    enableBlockReflection: false,
    chainBlockOver10KMode: false
  }),
  async save (newOption) {
    const option = Object.assign({}, this.defaults, newOption)
    return browser.storage.local.set({
      option
    })
  },
  async load () {
    const loaded = await browser.storage.local.get('option')
    return Object.assign({}, this.defaults, loaded.option)
  }
}
