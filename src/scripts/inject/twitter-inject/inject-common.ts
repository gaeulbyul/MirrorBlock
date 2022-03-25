export function dig(obj: () => any): any {
  try {
    return obj()
  } catch (err) {
    if (err instanceof TypeError) {
      return null
    } else {
      throw err
    }
  }
}

function isReactPropsKey(name: string) {
  return name.startsWith('__reactProps') || name.startsWith('__reactEventHandlers')
}

export function getReactEventHandler(target: Element): any {
  const key = Object.keys(target).find(isReactPropsKey)
  return key ? (target as any)[key] : null
}
