
import { EnumBase } from "./dataStruct/enums.ts";
import { Stack, Scope, CodePlace, Option, CodeScopeBlocks, None, analyzeBrackets, Some, ABorNA } from "./util.ts";
export { Scope, CodePlace }

type MatchGroups = {
  [key: string]: string;
}

type AddTransformParam = {
  regex: RegExp,
  replace?: (match: RegExpExecArray) => string
  replaceWGroup?: (
    groups: MatchGroups
  ) => string
  add?: (match: RegExpExecArray) => ({
    adding: string,
    scope: Scope,
    place: CodePlace
  })[],
  addWGroup?: (
    groups: MatchGroups
  ) => ({
    adding: string,
    scope: Scope,
    place: CodePlace
  })[],
  getAllMatches?: (matches: RegExpExecArray[]) => void
  getAllGroups?: (matches: MatchGroups[]) => void
  
}
const getGroups = ({ groups }: RegExpExecArray): MatchGroups => {
  if (!groups) throw new Error('`match.groups` not defined')
  return groups
}



export class Transformer {
  private modifying: {
    range: [number, number],
    replaceWith: string
  }[] = []
  scopeBlocksOption: Option<CodeScopeBlocks> = None
  constructor(private code: string) {
  }
  addTransform({
    regex, replace, add, addWGroup, replaceWGroup,
    getAllMatches, getAllGroups
  }: AddTransformParam) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null;
    let matchList: ABorNA<RegExpExecArray[], MatchGroups[]>
    if(getAllGroups){
      matchList = ABorNA.A([])
    } else if(getAllMatches){
      matchList = ABorNA.B([])
    } else {
      matchList = ABorNA.NA
    }
    while ((match = regex.exec(this.code)) !== null) {
      // const { /* indices, */ groups } = match
      const start = match.index, end = regex.lastIndex
      
      matchList.match({
        A: (list) => {// @ts-ignore: match is RegExpExecArray 
          list.push(match)
        },
        B: (list) => {// @ts-ignore: match is RegExpExecArray 
          list.push(getGroups(match))
        },
        NA:()=>{}
      })
      if (replace || replaceWGroup) {
        if (
          /* true if no overlap */
          this.modifying.every(({ range: [mStart, mEnd] }) =>
            !(mStart <= start && start < mEnd) && !(mStart < end && end <= mEnd)
          )
        ) {
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
        } else {
          throw new Error("Overlapped Replacement")
        }
      }
      let addingInfo: Array<{ adding: string; scope: Scope; place: CodePlace; }> | undefined;
      if (addWGroup) {
        addingInfo = addWGroup(getGroups(match))
      } else if (add) {
        if (addingInfo) throw new Error('cannot use both `addWGroup` and `add`')
        addingInfo = add(match)
      }

      let scopeBlocks: CodeScopeBlocks
      addingInfo?.forEach(({ adding, scope, place }) => {
        if (!scopeBlocks) {
          this.scopeBlocksOption.match({
            // previous `addTransform` call already cached scopeBlocks.
            Some: (blocks) => scopeBlocks = blocks,
            None: () => {
              // parsing
              scopeBlocks = analyzeBrackets(this.code).unwrap()
              this.scopeBlocksOption = Some(scopeBlocks)
            }
          })
        }

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
    matchList.match({
      A: (list) => {
        getAllMatches?.(list)
      },
      B: (list) => {
        getAllGroups?.(list)
      },
      _:()=>{}
    })
  }
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
