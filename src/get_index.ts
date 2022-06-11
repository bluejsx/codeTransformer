import { Scope, CodePlace, ScopeBlock, Some, None, Option } from "./util.ts";

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

export function getIndexFromPosition(
  code: string,
  blocks: ScopeBlock[],
  partStart: number,
  partEnd: number,
  scope: Scope,
  place: CodePlace
): number {
  if(scope === Scope.NONE){
    if(place === CodePlace.BEFORE) return partStart
    if(place === CodePlace.AFTER) return partEnd
    scope = Scope.FILE_ROOT
  }
  if (scope === Scope.FILE_ROOT) {
    if (place === CodePlace.START) return 0
    if (place === CodePlace.END) return code.length
    if (place === CodePlace.AFTER || place === CodePlace.BEFORE) {
      const found = blocks.find(
        ({ innerStart, end }) => innerStart <= partStart && partEnd <= end
      )
      if (found) {
        if (place === CodePlace.AFTER) {
          return found.end + 1
        }
        return found.outerStart
      }
      return getIndexFromPosition(code, blocks, partStart, partEnd, Scope.SAME, place)
    }
  }
  if (scope === Scope.CHILD) {
    if (place === CodePlace.START) {
      return partEnd  // ----!!!!------
    }
    if (place === CodePlace.END) {
      return getOpenBlockInInterval(blocks, partStart, partEnd, false)
        .expect(
          'Scope not opened; cannot find child scope:\n'
          + '----------------'
          + code.substring(partStart, partEnd)
          + '\n----------------'
        )
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
      .expect(
        'Could not find open bracket\n'
        + '----------------------\n'
        + code.substring(partStart, partEnd)
        + '\n-----------------------'
      )
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