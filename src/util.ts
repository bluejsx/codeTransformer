import { Stack } from "./dataStruct/stack.ts";
import { Result, Ok, Err, Option, Some, None, EnumBase } from './dataStruct/enums.ts'
export { Stack, Result, Ok, Err, Option, Some, None }
/**
 * specifies scope
 */
export enum Scope {
  FILE_ROOT,
  PARENT,
  PARENT_FUNC,
  SAME,
  CHILD
}
/**
 * specifies position
 */
export enum CodePlace {
  START,
  BEFORE,
  AFTER,
  END
}

export class ABorNA<A, B> extends EnumBase<{
  A: A, B: B, NA: undefined
}> {
  static A<NDA>(data: NDA) {
    return new ABorNA<NDA, any>("A", data)
  }
  static B<NDB>(data: NDB) {
    return new ABorNA<NDB, any>("B", data)
  }
  static NA = new ABorNA<any, any>("NA", undefined)
}

const bracketPairs = new Map<string, string>()
bracketPairs.set('{', '}')
bracketPairs.set('[', ']')
bracketPairs.set('(', ')')

/**
 * @returns first index of next pattern match
 */
const getNext = (regex: RegExp, code: string, start: number, getEnd = false) => {
  regex.lastIndex = start + 1
  const match = regex.exec(code)
  if (!match) {
    return code.length;
  }
  if(getEnd) return regex.lastIndex
  return match.index
}
/**
 * @returns index right after the end of the comment
 */
const skipComments = (code: string, index: number): Option<number> => {
  const char = code.charAt(index)
  if (char === '/') {
    const nextChar = code.charAt(index + 1)

    if (nextChar === '/') {
      // single line comment
      return Some(getNext(/\n/g, code, index + 1, true))
    } else if (nextChar === '*') {
      // multi line comment
      return Some(getNext(/\*\//g, code, index + 1, true))
    }
  } else if (char === "'") {
    return Some(getNext(/[^\\]'/g, code, index, true))
  } else if (char === '"') {
    return Some(getNext(/[^\\]"/g, code, index, true))
  } else if (char === "`") {
    return Some(getNext(/[^\\]`/g, code, index, true))
  }

  return None
}

type ScopeBlock = {
  outerStart: number
  innerStart: number
  end: number
  parentFuncOrRoot: ScopeBlock
}
type IndexGetter = (partStart: number, partEnd: number, scope: Scope, place: CodePlace) => number

const getOpenBlockInInterval = (blocks: ScopeBlock[], partStart: number, partEnd: number, outer = true): Option<ScopeBlock> => {
  let found: ScopeBlock | undefined
  if (outer) {
    found = blocks.find(
      ({ innerStart, end }) => partStart <= innerStart && innerStart <= partEnd && partEnd <= end // ? idk if it's < or <=
    )
  } else {
    found = blocks.findLast(
      ({ innerStart, end }) => partStart <= innerStart && innerStart <= partEnd && partEnd <= end
    )
  }
  if (found) return Some(found)
  return None
}

function getIndexFromPosition(
  code: string,
  blocks: ScopeBlock[],
  partStart: number,
  partEnd: number,
  scope: Scope,
  place: CodePlace
) {
  if (scope === Scope.FILE_ROOT) {
    if (place === CodePlace.START) return 0
    if (place === CodePlace.END) return code.length
    if (place === CodePlace.AFTER) {
      const found = blocks.find(
        ({ innerStart, end }) => innerStart <= partStart && partEnd <= end
      )
      if (found) return found.end + 1
      return code.length
    }
    // ----- BEFORE ------
  }
  if (scope === Scope.CHILD) {
    if (place === CodePlace.START) {
      return partEnd  // ----!!!!------
    }
    if (place === CodePlace.END) {
      return getOpenBlockInInterval(blocks, partStart, partEnd, false)
        .expect(
          'Scope not opened; cannot find child scope:\n "'
          + code.substring(partStart, partEnd)
          + '"')
        .end
    }
    throw new Error('You cannot use BEFORE and AFTER for Scope.CHILD option')
  }
  if (scope === Scope.SAME) {
    switch (place) {
      case CodePlace.BEFORE: {
        return partStart
      }
      case CodePlace.AFTER: {
        return getOpenBlockInInterval(blocks, partStart, partEnd).match({
          Some: (block) => block.end + 1,
          None: () => partEnd
        })
      }
      default:
        break;
    }
  }
  if (scope === Scope.PARENT_FUNC) {
    const parentScope = getOpenBlockInInterval(blocks, partStart, partEnd)
      .expect('Could not find open bracket' + code.substring(partStart, partEnd))
      .parentFuncOrRoot
    switch (place) {
      case CodePlace.BEFORE: {
        return parentScope.outerStart
      }
      case CodePlace.START: {
        return parentScope.innerStart
      }
      case CodePlace.END: {
        return parentScope.end
      }
      case CodePlace.AFTER: {
        return parentScope.end + 1
      }
      default:
        break;
    }

  }
  throw new Error('Not supported yet')
}

export type CodeScopeBlocks = {
  blocks: ScopeBlock[],
  getIndex: IndexGetter
}
const matchedExpIndexes = (code: string, regex: RegExp, start: number) => {
  regex.lastIndex = start
  const match = regex.exec(code)
  if (!match) {
    return [-1, -1];
  }
  return [match.index, regex.lastIndex]
}
/**
 * Analyzes the brackets in the code then 
 * creates object that has scope info
 */
export const analyzeBrackets = (code: string): CodeScopeBlocks => {
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
  const blockStack = new Stack<[string, ScopeBlock]>()
  const parentStack = new Stack<ScopeBlock>()
  const root = {
    outerStart: 0,
    innerStart: 0,
    end: code.length,
  } as ScopeBlock
  root.parentFuncOrRoot = root
  parentStack.push(root)

  for (let i = 0, len = code.length; i < len; i++) {
    if (
      skipComments(code, i)
        .if_let("Some", (skipIndex) => i = skipIndex - 1)
    ) {
      continue
    }
    const char = code.charAt(i)
    if (char === 'f') {
      const [outerStart, innerStart] = matchedExpIndexes(
        code,
        /function[\w ]*\([\w{},\[\] ]*\) *{/g,
        i
      )
      if (outerStart === i) {
        i = innerStart
        const funcScope = {
          outerStart,
          innerStart,
          end: 0,
          parentFuncOrRoot: parentStack.peek()
        } as ScopeBlock
        blockStack.push(['{', funcScope])
        blocks.push(funcScope)
        parentStack.push(funcScope)
        continue
      }
    } else if (char === '{' || char === '[' || char === '(') {
      const scope = {
        outerStart: i,
        innerStart: i + 1,
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
      if (bracketPairs.get(top[0]) === char) {
        // closing a scope
        blockStack.pop()
        const scope = top[1]
        scope.end = i
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