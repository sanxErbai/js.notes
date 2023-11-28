class MemoryStorage {
  public data: Record<string, string | undefined> = {}

  getItem(key: string) {
    return this.data[key] ?? null
  }

  setItem(key: string, value: any) {
    this.data[key] = `${value}`
  }

  removeItem(key: string) {
    this.data[key] = undefined
  }

  clear() {
    this.data = {}
  }
}

export default MemoryStorage
