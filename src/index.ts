import { Scope, CodePlace, Option, CodeScopeBlocks, None, analyzeBrackets, Some, ABorNA } from "./util.ts";
export { Scope, CodePlace }

type MatchGroups = {
  [key: string]: string;
}

type AddTransformParam = {
  regex: RegExp,
  /**
   * replaces the matched range with the returning string.
   * Takes in match object.
   */
  replace?: (match: RegExpExecArray) => string
  /**
   * replaces the matched range with the returning string.
   * Takes in matched groups object
   */
  replaceWGroup?: (
    groups: MatchGroups
  ) => string
  /**
   * adds code in specified code area.
   * Takes in match object.
   */
  add?: (match: RegExpExecArray) => ({
    adding: string,
    scope: Scope,
    place: CodePlace
  })[],
  /**
   * adds code in specified code area.
   * Takes in matched groups object
   */
  addWGroup?: (
    groups: MatchGroups
  ) => ({
    adding: string,
    scope: Scope,
    place: CodePlace
  })[],
  /**
   * It allows nesting and creating additional `AddTransformParam` manipulation
   * within the scope that starts from the matched area.
   * 
   * Takes in match object and index range of matched part.
   * 
   * The range would be useful to use with `.addTransform({...}, range)`
   */
  nest?: (match: RegExpExecArray, range: [number, number]) => AddTransformParam[],
  /**
   * It allows nesting and creating additional `AddTransformParam` manipulation
   * within the scope that starts from the matched area.
   * 
   * Takes in matched group object and index range of matched part.
   * 
   * The range would be useful to use with `.addTransform({...}, range)`
   */
  nestWGroup?: (
    groups: MatchGroups,
    range: [number, number]
  ) => AddTransformParam[],
  /**
   * takes in matched groups object
   */
  WGroup?: (groups: MatchGroups) => void
  getAllMatches?: (matches: RegExpExecArray[]) => void
  getAllGroups?: (matches: MatchGroups[]) => void
}
/**
 * Takes in match object and returns matched groups object.
 * 
 * Throws error if matched groups object is not found.
 */
const getGroups = ({ groups }: RegExpExecArray): MatchGroups => {
  if (!groups) throw new Error('`match.groups` not defined')
  return groups
}


/**
 * Usage:
 * ```ts
 * // create code transformer
 * const t1 = new Transformer(code)
 * t1.addTransform({
 *   // add code transform rules
 * })
 * t1.addTransform({
 *   // add code transform rules
 * })
 * // get result code
 * const result = t1.transform()
 * ```
 */
export class Transformer {
  private modifying: {
    range: [number, number],
    replaceWith: string
  }[] = []
  scopeBlocks: Option<CodeScopeBlocks> = None
  constructor(private code: string) {
  }
  /**
   * Example:
   * ```ts
   * const t = new Transformer('Yay! Hello, sir!')
   * t.addTransform({
   *   regex: /Hello, (?<name>\w+)!/g,
   *   replaceWGroup({ name }){
   *     return `Sup, ${name}!!!`
   *   }
   * })
   * t.transform() === 'Yay! Sup, sir!!!'
   * ```
   * 
   * ### Description
   * 
   * Each manipulation function that has `WGroup` in its name
   * takes in `match.groups` instead of `match`.
   * 
   * These manipulation processes often utilize
   * [capturing groups](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Groups_and_Ranges#using_groups).
   * 
   * - **`match`**
   *   - the return value of [`RegExp.exec()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec).
   * - **`match.groups`**
   *   - undefined if no named capturing group is present in regex
   * 
   */
  addTransform(
    {
      regex, replace, add, addWGroup, replaceWGroup,
      getAllMatches, getAllGroups, nestWGroup, nest,
      WGroup
    }: AddTransformParam,
    range?: [number, number]
  ) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null;
    let matchList: ABorNA<RegExpExecArray[], MatchGroups[]>
    if (getAllGroups) {
      matchList = ABorNA.A([])
    } else if (getAllMatches) {
      matchList = ABorNA.B([])
    } else {
      matchList = ABorNA.NA
    }
    if (range) {
      regex.lastIndex = range[0]
    }
    while ((match = regex.exec(this.code)) !== null) {
      // const { /* indices, */ groups } = match
      const start = match.index, end = regex.lastIndex
      if (range && range[1] < end) break
      matchList.match({
        A: (list) => {// @ts-ignore: match is not null 
          list.push(match)
        },
        B: (list) => {// @ts-ignore: match is not null 
          list.push(getGroups(match))
        },
        NA: () => { }
      })

      if (replace || replaceWGroup) {
        const overlap = this.modifying.find(({ range: [mStart, mEnd] }) =>
          (mStart <= start && start < mEnd) || (mStart < end && end <= mEnd)
        )
        if (overlap) {
          throw new Error(
            'Overlapped Replacement:\n'
            + '-----Trying to modify range: -----\n'
            + this.code.substring(start, end)
            + "\n-----Overlaped with: -----\n"
            + this.code.substring(...overlap.range)
            + "\n--------------------------")
        } else {
          if (replaceWGroup) {
            this.modifying.push({
              range: [start, end],
              replaceWith: replaceWGroup(getGroups(match))
            })
          } else if (replace) {
            this.modifying.push({
              range: [start, end],
              replaceWith: replace(match)
            })
          }
        }
      }
      let addingInfo: Array<{ adding: string; scope: Scope; place: CodePlace; }> | undefined;
      if (addWGroup) {
        addingInfo = addWGroup(getGroups(match))
      } else if (add) {
        if (addingInfo) throw new Error('cannot use both `addWGroup` and `add`')
        addingInfo = add(match)
      }
      WGroup?.(getGroups(match))
      if (addingInfo || nestWGroup || nest) {
        const scopeBlocks = this.scopeBlocks.match({
          // previous `addTransform` call already cached scopeBlocks.
          Some: (blocks) => blocks,
          None: () => {
            // parsing
            const blocks = analyzeBrackets(this.code)
            this.scopeBlocks = Some(blocks)
            return blocks
          }
        })
        if (nestWGroup || nest) {
          const range = [
            scopeBlocks.getIndex(start, end, Scope.CHILD, CodePlace.START),
            scopeBlocks.getIndex(start, end, Scope.CHILD, CodePlace.END)
          ] as [number, number]

          (
            nestWGroup?.(getGroups(match), range)
            || nest?.(match, range)
            || []
          ).forEach((transform) => {
            this.addTransform(transform, range)
          })
        }
        addingInfo?.forEach(({ adding, scope, place }) => {

          const index = scopeBlocks.getIndex(start, end, scope, place)
          if (
            /* true if no overlap */
            this.modifying.every(({ range: [mStart, mEnd] }) =>
              index < mStart || mEnd <= index
            )
          ) {
            this.modifying.push({
              range: [index, index],
              replaceWith: adding
            })
          } else {
            throw new Error("Overlapped Adding")
          }
        })
      }
    }
    matchList.match({
      A: (list) => {
        getAllMatches?.(list)
      },
      B: (list) => {
        getAllGroups?.(list)
      },
      _: () => { }
    })
  }
  /**
   * Call this method after 
   * registering all transforming rules with `addTransform`
   * @returns transformed result code
   */
  transform() {
    let shift = 0
    let { code } = this
    this.modifying
      .sort((a, b) => a.range[0] - b.range[0])
      .forEach(({ range, replaceWith }) => {
        const start = range[0] + shift, end = range[1] + shift
        code = code.substring(0, start) + replaceWith + code.substring(end)
        shift += replaceWith.length - end + start
      })
    return code
  }
}

export function assertObj(condition: any): asserts condition {
  if (!condition) {
    throw new Error('');
  }
}
