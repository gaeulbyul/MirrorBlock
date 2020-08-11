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

export function getReactEventHandler(target: Element): any {
  const key = Object.keys(target)
    .filter((k: string) => k.startsWith('__reactEventHandlers'))
    .pop()
  return key ? (target as any)[key] : null
}
