import { Stack } from "./dataStruct/stack.ts";
import { getIndexFromPosition } from "./get_index.ts";
export { Result, Ok, Err, Option, Some, None } from 'https://cdn.skypack.dev/rusty-enums@^1.0.8?dts'
/**
 * specifies scope
 */
export enum Scope {
  FILE_ROOT,
  PARENT,
  PARENT_FUNC,
  SAME,
  NONE,
  CHILD
}
/**
 * specifies position to a scope
 */
export enum CodePlace {
  START,
  BEFORE,
  AFTER,
  END
}

export type ScopeBlock = {
  outerStart: number
  innerStart: number
  end: number
  parentFuncOrRoot: ScopeBlock
}
type IndexGetter = (partStart: number, partEnd: number, scope: Scope, place: CodePlace) => number


export type CodeScopeBlocks = {
  blocks: ScopeBlock[],
  /**
   * gets index of code string using position info
   */
  getIndex: IndexGetter
}

const bracketMatches = (open: string, close: string) => {
  if (open === '{' && close === '}') return true
  if (open === '[' && close === ']') return true
  if (open === '(' && close === ')') return true
  return false
}

export const rangeIsInCommentDetector = (comment_positions: [number, number][]) => {
  const { length } = comment_positions
  let i = 0
  let reachedEnd = false
  return {
    /**
     * Returns true if the range is in a comment.
     * 
     * **Expected to be used repeatedly in increasing order of index** because 
     * the function never goes back to already checked comments.
     */
    range_is_in_comment: (start: number, end: number) => {
      if (reachedEnd) return false
      for (; i < length; i++) {
        const [comment_start, comment_end] = comment_positions[i]
        if (comment_end <= start) {
          continue
        }
        if (end <= comment_start) {
          return false
        }
        if (comment_start <= start && end <= comment_end) {
          return true
        }
      }
      reachedEnd = true
      return false
    }
  }
}
/**
 * Analyzes the brackets in the code then 
 * creates object that has scope info
 */
export const analyzeBrackets = (code: string, comment_positions: [number, number][]): CodeScopeBlocks => {
  const { range_is_in_comment } = rangeIsInCommentDetector(comment_positions)
  const reg_brackets = /(?:function[\w ]*\([\w{},\[\] ]*\) *{)|{|\[|\(|}|\]|\)/g

  const blocks: ScopeBlock[] = []
  const codeScopeBlocks: CodeScopeBlocks = {
    blocks,
    getIndex: (
      partStart,
      partEnd,
      scope,
      place
    ) => getIndexFromPosition(code, blocks, partStart, partEnd, scope, place)
  }
  const blockStack = new Stack<['{' | '[' | '(', ScopeBlock]>()
  const parentStack = new Stack<ScopeBlock>()
  const root = {
    outerStart: 0,
    innerStart: 0,
    end: code.length,
  } as ScopeBlock
  root.parentFuncOrRoot = root
  parentStack.push(root)
  let match: RegExpExecArray | null;
  while ((match = reg_brackets.exec(code)) !== null) {
    const index = match.index
    if (range_is_in_comment(index, index)) continue;
    const char = match[0]
    if (char.charAt(0) === 'f') {
      const funcScope = {
        outerStart: index,
        innerStart: reg_brackets.lastIndex,
        end: 0,
        parentFuncOrRoot: parentStack.peek()
      } as ScopeBlock
      blockStack.push(['{', funcScope])
      blocks.push(funcScope)
      parentStack.push(funcScope)
    } else if (char === '{' || char === '[' || char === '(') {
      const scope = {
        outerStart: index,
        innerStart: index + 1,
        end: 0,
        parentFuncOrRoot: parentStack.peek()
      } as ScopeBlock
      blockStack.push([char, scope])
      blocks.push(scope)
    } else if (char === '}' || char === ']' || char === ')') {
      const top = blockStack.peek()
      if (!top) {
        throw new Error('closing bracket without opening')
      }
      if (bracketMatches(top[0], char)) {
        // closing a scope
        blockStack.pop()
        const scope = top[1]
        scope.end = index
        if (parentStack.peek() === scope) {
          parentStack.pop()
        }
      } else {
        throw new Error('unmatched pair of bracket:' + top + char)
      }
    }
  }
  return codeScopeBlocks
}