class Node<T> {
  constructor(public data: T, public prev?: Node<T>) { }
  add(data: T) {
    return new Node<T>(data, this)
  }
}
export class Stack<T> {
  private top: Node<T> | undefined
  push(data: T) {
    if (this.top) {
      this.top = this.top.add(data)
    } else {
      this.top = new Node(data)
    }
  }
  pop() {
    const topData = this.top?.data
    this.top = this.top?.prev
    return topData
  }
  peek() {
    return this.top?.data
  }
  isEmpty() {
    return this.top === undefined
  }
}