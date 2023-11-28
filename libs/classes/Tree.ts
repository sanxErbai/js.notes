export type TreeNode<T> = T & {
  parentNode?: TreeNode<T>;
  children?: TreeNode<T>[];
  isLeaf?: boolean;
  level?: number;
};

export interface TreeOptions<T, P = string> {
  getId?: (item: T) => P;
}

export interface TreeSetListOptions<T, P = string, R = T> extends TreeOptions<T, P> {
  getParentId?: (item: T) => P;
  isRoot?: (item: T) => boolean;
  format?: (item: T) => R;
}

// 生成深度优先遍历or广度优先遍历函数
const compileSearchTree = (isBFS = false) => <T>(tree: TreeNode<T>[], cb: (node: TreeNode<T>, prevNode?: TreeNode<T>, collect?: boolean) => boolean | void) => {
  const queue: TreeNode<T>[] = [];
  const getNextNode = isBFS ? () => queue.shift() : () => queue.pop();
  const needCollectFlag = cb.length >= 3;

  let collectPrevNode: TreeNode<T> | undefined;
  const pushQueue = (nodes: TreeNode<T>[]) => {
    nodes.forEach((node) => {
      queue.push(node);

      if (needCollectFlag) {
        cb(node, collectPrevNode, true);
        collectPrevNode = node;
      }
    });
  };

  pushQueue(tree);

  let prevNode: TreeNode<T> | undefined;
  let node = getNextNode();

  while (node) {
    const loopResult = cb(node, prevNode);

    if (loopResult === false) {
      return;
    }

    if (loopResult !== true && node.children?.length) {
      pushQueue(node.children);
    }

    prevNode = node;
    node = getNextNode();
  }
};

// 向上回溯treeNode
function backtrackingNode<T>(
  target: TreeNode<T>,
  cb: (node: TreeNode<T>) => false | void
): void;
function backtrackingNode<T, R>(
  target: TreeNode<T>,
  cb: (prev: R, node: TreeNode<T>) => false | R,
  initial: R
): R;
function backtrackingNode<T, R>(
  target: TreeNode<T>,
  cb: (prev: TreeNode<T> | R, node?: TreeNode<T>) => false | R | void,
  initial?: R
): R | void {
  let currentNode: TreeNode<T> | undefined = target;
  let result: R | void = initial;

  while (currentNode) {
    const loopResult =
      cb.length > 1 ? cb(currentNode) : cb(result!, currentNode);

    if (loopResult === false) {
      break;
    }

    result = loopResult;
    currentNode = currentNode.parentNode;
  }

  return result;
}

// 递归treeNode
function recursiveTree<T, R = T>(
  tree: TreeNode<T>[],
  cb: (node: TreeNode<T>, parentNode?: TreeNode<R>) => TreeNode<R> | undefined,
  parentNode?: TreeNode<R>,
  initial?: TreeNode<R>[]
) {
  return tree.reduce<TreeNode<R>[]>((prev, node) => {
    const resolvedNode = cb(node, parentNode);

    if (resolvedNode) {
      resolvedNode.children = node.children && recursiveTree(node.children, cb, resolvedNode);

      resolvedNode.isLeaf = !resolvedNode.children?.length;

      if (resolvedNode.isLeaf) {
        resolvedNode.children = undefined;
      }

      return [...prev, resolvedNode];
    }

    return prev;
  }, initial || []);
}

class Tree<T, P = string> {
  static DFSTree = compileSearchTree();

  static BFSTree = compileSearchTree(true);

  static recursiveTree = recursiveTree;

  static backtrackingNode = backtrackingNode;

  private tree: TreeNode<T>[] | undefined;

  private treeNodeMap: Map<P, TreeNode<T>> = new Map();

  constructor(source?: TreeNode<T>[], options?: TreeOptions<TreeNode<T>, P>) {
    if (source) {
      this.setTree(source, options);
    }
  }

  getTree() {
    return this.tree;
  }

  getNode(key: P): TreeNode<T> | undefined {
    return this.treeNodeMap.get(key);
  }

  setTree(source: TreeNode<T>[], options: TreeOptions<TreeNode<T>, P> = {}) {
    const { getId = (item: any) => item.id as P } = options;
    this.treeNodeMap = new Map();

    this.tree = Tree.recursiveTree(source, (node, parentNode) => {
      const reservedNode = {
        ...node,
        parentNode,
        isLeaf: !node.children?.length,
        level: parentNode?.level ? parentNode.level + 1 : 1,
      };

      this.treeNodeMap.set(getId(reservedNode), reservedNode);

      return reservedNode;
    });
  }

  setList<S>(list: S[], options: TreeSetListOptions<S, P, TreeNode<T>> = {}) {
    const {
      getId = (item: any) => item.id as P,
      getParentId = (item: any) => item.parentId as P,
      isRoot = (item) => !getParentId(item),
      format = (item: any) => ({ ...item } as TreeNode<T>),
    } = options;

    this.tree = [];
    this.treeNodeMap = new Map();

    list.forEach((item) => {
      const id = getId(item);
      const parentId = getParentId(item);
      const cacheItem = this.treeNodeMap.get(id);
      let formattedItem = format(item);

      if (cacheItem) {
        formattedItem = Object.assign(cacheItem, formattedItem, {
          children: cacheItem?.children,
          isLeaf: false,
          level: 1,
        });
      } else {
        formattedItem = {
          ...formattedItem,
          isLeaf: true,
          level: 1,
        };
        this.treeNodeMap.set(id, formattedItem);
      }

      if (parentId) {
        const cacheParentItem = this.treeNodeMap.get(parentId);

        if (cacheParentItem) {
          if (!cacheParentItem.children) {
            cacheParentItem.children = [formattedItem];
            cacheParentItem.isLeaf = false;
          } else {
            cacheParentItem.children.push(formattedItem);
          }

          formattedItem.level = cacheParentItem.level! + 1;
        } else {
          this.treeNodeMap.set(parentId, {
            children: [formattedItem],
          } as TreeNode<T>);
        }

        formattedItem.parentNode = this.treeNodeMap.get(parentId);
      }

      // 对于遍历前就以cache的数据，校正level值
      if (cacheItem) {
        Tree.DFSTree([formattedItem], (node) => {
          if (node.parentNode) {
            node.level = node.parentNode.level! + 1;
          }
        });
      }

      if (isRoot(item)) {
        this.tree!.push(formattedItem);
      }
    });
  }

  DFSTree(cb: (node: TreeNode<T>, prevNode?: TreeNode<T>, collect?: boolean) => boolean | void) {
    if (this.tree?.length) {
      Tree.DFSTree(this.tree, cb);
    }
  }

  BFSTree(cb: (node: TreeNode<T>, prevNode?: TreeNode<T>, collect?: boolean) => boolean | void) {
    if (this.tree?.length) {
      Tree.BFSTree(this.tree, cb);
    }
  }

  recursiveTree<R = T>(cb: (node: TreeNode<T>, parentNode?: TreeNode<R>) => TreeNode<R> | undefined) {
    if (this.tree?.length) {
      return Tree.recursiveTree<TreeNode<T>, R>(this.tree, cb);
    }

    return []
  }
}

export default Tree;
