// 模拟react fiber的结构，支持快速定位
export type FiberTreeNode<T> = T & {
  fiberParent?: FiberTreeNode<T> // 父级节点
  fiberPrev?: FiberTreeNode<T> // 前一个兄弟节点
  fiberNext?: FiberTreeNode<T> // 下一个兄弟节点
  fiberFirstChild?: FiberTreeNode<T> // 第一个child节点
  fiberLastChild?: FiberTreeNode<T> // 最后一个child节点
  children?: FiberTreeNode<T>[] // children集合
  fiberDprExplored?: 1
  removed?: 1 // 被移除节点
}

export interface TreeModelOptions<T, P> {
  root: T
  key: (node: FiberTreeNode<T>) => P | undefined
  parentKey: (node: FiberTreeNode<T>) => P | undefined
  nodes?: T[]
  api?: (node: FiberTreeNode<T>) => Promise<T[]>
}

export type DprNodesHandle<T> = (node: FiberTreeNode<T>, prevNode?: FiberTreeNode<T>, reverse?: boolean) => boolean

export const createFiberTreeNode = <T>(node: T): FiberTreeNode<T> => ({
  ...node,
  fiberParent: undefined,
  fiberPrev: undefined,
  fiberNext: undefined,
  fiberFirstChild: undefined,
  fiberLastChild: undefined,
  children: undefined,
  fiberDprExplored: undefined,
  removed: undefined,
})

export const childrenChainToArray = <T>(node: FiberTreeNode<T>, handle?: (node: FiberTreeNode<T>) => void) => {
  let childNode = node.fiberFirstChild

  if (!childNode) {
    return undefined
  }

  const arr: FiberTreeNode<T>[] = []

  while (childNode) {
    handle?.(childNode)

    arr.push(childNode)

    childNode = childNode.fiberNext
  }

  return arr
}

export default class TreeModel<T, P extends string | number = string> {
  private root: FiberTreeNode<T> // 根节点

  private nodes: FiberTreeNode<T>[] = [] // 所有拍平的节点

  private nodesMap: Map<P, FiberTreeNode<T>> = new Map()// 所有节点hash cache

  private key: TreeModelOptions<T, P>['key'] // 主键key值

  private parentKey: TreeModelOptions<T, P>['parentKey'] // 父级节点key值

  private api: TreeModelOptions<T, P>['api'] // 异步数据源

  constructor(options: TreeModelOptions<T, P>, handle?: DprNodesHandle<T>) {
    if (!options.root) {
      throw new Error('根节点不能为空')
    }

    // 处理root需要再构造函数中赋值的lint问题
    this.root = createFiberTreeNode<T>(options.root)

    this.key = options.key
    this.parentKey = options.parentKey
    this.api = options.api

    this.setRoot(options.root, handle)

    if (options.nodes) {
      this.setNodes(options.nodes)
    }
  }

  // 更新根节点
  public setRoot(node: T, handle?: DprNodesHandle<T>) {
    this.nodes = []
    this.nodesMap = new Map()

    this.root = this.setNode(node, handle)
  }

  // 更新节点
  public setNodes(nodes: T[]) {
    this.root.children = undefined
    this.nodes = []
    this.nodesMap = new Map()

    this.pushNode(this.root)
    this.setNodesMap(this.root)
    this.addNodes(nodes)

    if (!this.root.children) {
      throw new Error('构建失败，请检查数据是否正确')
    }
  }

  // 添加节点
  public addNodes(nodes: T[]) {
    const cacheMap = new Map<P, FiberTreeNode<T>[]>()

    nodes.forEach(node => {
      const fiberNode = createFiberTreeNode<T>(node)
      const key = this.key(fiberNode)

      if (key) {
        const cacheChildren = cacheMap.get(key)

        if (cacheChildren?.length) {
          let childNode = cacheChildren[0]

          fiberNode.children = cacheChildren
          fiberNode.fiberFirstChild = childNode

          while (childNode.fiberNext) {
            childNode.fiberParent = fiberNode

            childNode = childNode.fiberNext
          }

          childNode.fiberParent = fiberNode
          fiberNode.fiberLastChild = childNode
        }

        const parentKey = this.parentKey(fiberNode)

        if (parentKey) {
          const parentNode = this.getNode(parentKey)
          const cacheSiblings = cacheMap.get(parentKey)

          if (parentNode) {
            fiberNode.fiberParent = parentNode

            if (!parentNode?.children?.length) {
              parentNode.children = [fiberNode]
              parentNode.fiberFirstChild = fiberNode
              parentNode.fiberLastChild = fiberNode
            } else {
              const parentNodeLastChild = parentNode.fiberLastChild

              if (!parentNodeLastChild) {
                throw new Error(`节点${this.key(parentNode)}构建异常`)
              }

              parentNode.children.push(fiberNode)
              parentNode.fiberLastChild = fiberNode
              parentNodeLastChild.fiberNext = fiberNode
              fiberNode.fiberPrev = parentNodeLastChild
            }
          } else if (cacheSiblings?.length) {
            const lastNode = cacheSiblings.slice(-1)[0]

            cacheSiblings.push(fiberNode)

            lastNode.fiberNext = fiberNode
            fiberNode.fiberPrev = lastNode
          } else {
            cacheMap.set(parentKey, [fiberNode])
          }
        }

        this.pushNode(fiberNode)
        this.setNodesMap(fiberNode)
      }
    })
  }

  // 推入节点
  private pushNode(node: FiberTreeNode<T>) {
    this.nodes.push(node)
  }

  public getNodes(root?: FiberTreeNode<T>, filter?: (node: FiberTreeNode<T>) => boolean) {
    if (root) {
      const nodes: FiberTreeNode<T>[] = []

      this.dprNodes(root, node => {
        const filterResult = !filter || filter(node)

        if (filterResult) {
          nodes.push(node)
        }

        return !filterResult
      })

      return nodes
    }

    return (filter ? this.nodes.filter(filter) : this.nodes)
  }

  // // 异步拉取子节点
  // public pullNodeChildren(node: FiberTreeNode<T>) => Promise<FiberTreeNode<T>[]>
  // Depth First Recursive(深度优先遍历)，用来计算节点
  public dprNodes(root: FiberTreeNode<T>, handle?: DprNodesHandle<T>, reverse: boolean = false) {
    const fiberRoot = this.getNode(this.key(root)) || createFiberTreeNode<T>(root)
    const stacks = [fiberRoot]
    let lastNode: FiberTreeNode<T> | undefined

    while (stacks.length) {
      const node = stacks.pop()

      if (node) {
        if (node?.fiberDprExplored || !node.children?.length) {
          handle?.(node, lastNode, reverse)
          lastNode = node
          node.fiberDprExplored = undefined
        } else {
          const handleResult = handle?.(node, lastNode, reverse)

          lastNode = node

          if (!handleResult) {
            node.fiberDprExplored = 1

            // 下探的节点，还需一次回溯
            stacks.push(node)

            const subNodes = node.children.map((subNode, index) => {
              let fiberSubNode = this.getNode(this.key(subNode))

              if (!fiberSubNode) {
                fiberSubNode = createFiberTreeNode<T>(subNode)
                node.children![index] = fiberSubNode
              }

              return fiberSubNode
            })

            if (!reverse) {
              subNodes.reverse()
            }

            stacks.push(...subNodes)
          }
        }
      }
    }
  }

  public setNode(root: T, handle?: DprNodesHandle<T>) {
    const fiberNode = createFiberTreeNode<T>(root)

    const cacheNode = this.getNode(this.key(fiberNode))

    if (cacheNode) {
      this.dprNodes(cacheNode, node => {
        this.removeNode(node)

        return false
      })
    }

    this.dprNodes(fiberNode, (node, prevNode, reverse) => {
      const nodeKey = this.key(node)
      const nodeParentKey = this.parentKey(node)

      if (prevNode) {
        if (nodeParentKey === this.key(prevNode)) {
          // prevNode是node的父节点
          node.fiberParent = prevNode

          if (reverse) {
            node.fiberNext = undefined
            prevNode.fiberLastChild = node
          } else {
            node.fiberPrev = undefined
            prevNode.fiberFirstChild = node
          }
        } else if (nodeKey === this.parentKey(prevNode)) {
          // prevNode是node的子节点
          if (reverse) {
            node.fiberFirstChild = prevNode
            prevNode.fiberPrev = undefined
          } else {
            node.fiberLastChild = prevNode
            prevNode.fiberNext = undefined
          }
        } else {
          // prevNode是node的兄弟节点
          node.fiberParent = prevNode.fiberParent

          if (reverse) {
            node.fiberNext = prevNode
            prevNode.fiberPrev = node
          } else {
            node.fiberPrev = prevNode
            prevNode.fiberNext = node
          }
        }
      }

      if (!this.getNode(nodeKey)) {
        this.pushNode(node)
        this.setNodesMap(node)
      }

      return handle?.(node, prevNode) || false
    })

    return fiberNode
  }

  public getNode(key: P | undefined, all = false) {
    if (key) {
      const node = this.nodesMap.get(key)

      if (all || (node && !node.removed)) {
        return node
      }
    }

    return undefined
  }

  private setNodesMap(node: FiberTreeNode<T>) {
    const key = this.key(node)

    if (key) {
      this.nodesMap.set(key, node)
    }
  }

  public removeNode(node: FiberTreeNode<T>) {
    node.fiberDprExplored = undefined
    node.removed = 1

    this.cleanNodes()
  }

  // 清除掉已经removed
  private cleanNodes() {
    // 异步清理已失效数据
    console.log(this.nodes)
  }
}
