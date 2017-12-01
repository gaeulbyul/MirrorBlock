/* globals browser */

const defaultOption = {
  outlineBlockUser: false,
  enableBlockReflection: false
}

const elements = {
  outlineBlockUser: document.getElementById('outlineBlockUser'),
  enableBlockReflection: document.getElementById('enableBlockReflection')
}

function saveOption () {
  const option = Object.assign({}, defaultOption)
  for (const key of Object.keys(elements)) {
    option[key] = elements[key].checked
  }
  return browser.storage.local.set({
    option
  })
}

async function loadOption () {
  const customOption = (await browser.storage.local.get('option')).option
  const option = Object.assign({}, defaultOption, customOption)
  for (const key of Object.keys(elements)) {
    elements[key].checked = option[key]
  }
}

function init () {
  loadOption()
  for (const input of document.querySelectorAll('.field input')) {
    input.addEventListener('change', event => {
      saveOption()
    })
  }
  /*
  document.querySelector('.saveButton').onclick = event => {
    event.preventDefault();
    saveOption();
  };
  */
}

document.addEventListener('DOMContentLoaded', init)
