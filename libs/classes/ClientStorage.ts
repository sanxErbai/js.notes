import MemoryStorage from './MemoryStorage'

const parseStorage = (str: string | null) => {
  if (str === null) {
    return null
  }

  try {
    return JSON.parse(str)
  } catch (error) {
    return null
  }
}

export interface StorageOptions {
  type?: 'local' | 'session' | 'memory'
  prefix?: string
}

export interface SetOptions {
  expiration?: number
}

interface StorageExtra {
  t?: 'u' | 'b' | 'n' | 'bi' | 'o'
  e?: number
}

const getExtraKey = (key: string) => `__store_${key}_extra__`

class ClientStorage {
  public options: StorageOptions

  public store: Storage | MemoryStorage

  constructor(options: StorageOptions = {}) {
    this.options = options
    this.store = this.getStore()
  }

  getStore() {
    switch (this.options.type) {
      case 'session':
        return window.sessionStorage

      case 'memory':
        return new MemoryStorage()

      default:
        return window.localStorage
    }
  }

  getKey(key: string) {
    if (this.options.prefix) {
      return `${this.options.prefix}_${key}`
    }

    return key
  }

  get(baseKey: string) {
    const key = this.getKey(baseKey)
    const extraKey = getExtraKey(key)
    const extra = (parseStorage(this.store.getItem(extraKey)) || {}) as StorageExtra
    const expiration = Number(extra.e)

    if (!Number.isNaN(expiration) && expiration < Date.now()) {
      this.store.removeItem(key)
      this.store.removeItem(extraKey)

      return null
    }

    const value = this.store.getItem(key)

    switch (extra.t) {
      case 'u':
        return undefined

      case 'b':
        return !Number(value)

      case 'n':
        return Number(value)

      case 'bi':
        return BigInt(value || 0)

      case 'o':
        return parseStorage(value)

      default:
        return value
    }
  }

  set(baseKey: string, value: any, options: SetOptions = {}) {
    const key = this.getKey(baseKey)
    const extra: StorageExtra = {}
    let storeValue: any

    if (options.expiration) {
      extra.e = Date.now() + options.expiration
    }

    switch (typeof value) {
      case 'undefined':
        storeValue = ''
        extra.t = 'u'
        break

      case 'boolean':
        storeValue = +!value
        extra.t = 'b'
        break

      case 'number':
        storeValue = value
        extra.t = 'n'
        break

      case 'bigint':
        storeValue = value
        extra.t = 'bi'
        break

      case 'object':
        storeValue = JSON.stringify(value)
        extra.t = 'o'
        break

      default:
        storeValue = value
    }

    this.store.setItem(key, storeValue)

    if (Object.keys(extra).length) {
      this.store.setItem(getExtraKey(key), JSON.stringify(extra))
    }
  }

  remove(baseKey: string) {
    const key = this.getKey(baseKey)

    this.store.removeItem(key)
    this.store.removeItem(getExtraKey(key))
  }

  clear() {
    this.store.clear()
  }
}

export default ClientStorage
