// import { assert, fail, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Transformer, Scope, CodePlace } from '../src/index.ts'



`import { Comp, Comp2 } from '../file'

export default (_bjsx_comp_attr)=>{
  const refs={}
  let { attr1, children } = _bjsx_comp_attr
  const pppppp = Blue.r(Comp2, { class: 'hello',  ref: [refs, 'c2'] })  // pppppp
  const self = Blue.r("div", null, 
    Blue.r(Comp, { class: 'hello' })
  )
  const { c2 } = refs
  setInterval(()=>c2.__newestElem.v++, 1000)
  c2.aa = 3
  c2.__assignProp('aa')
  c2.bb(78)
  if(import.meta.hot){
    self.__newestElem = self
    // update itself
    import.meta.hot.accept(({ default })=>{
      const newElem = Blue.r(default, _bjsx_comp_attr, _bjsx_comp_attr.children)
      self.__newestElem = newElem
      self.before(newElem)
      self.remove()
    })
  }
  return self
}
export const AA = ({ children }) => Blue.r('div', null, children)

// {
/*
  {
*/
function BB({ children }){
  const reff = getRefs<{
    p: 'progress'
  }>()
  const self = Blue.r('div', null, 
    Blue.r('progress', { value: 5, max: 10, ref: [reff, 'p'] }),
    children
  )
  const { p } = reff
  p.value = 90
  return self
}

document.body.append(Blue.r(AA, null))
`;
/**
 * observe `self`'s
 * - assigned property
 * - executed functions
 */

let code = `import Comp from '../file'

export default ({ attr1, children })=>{
  const self = Blue.r("div", null, 
    Blue.r(Comp, { class: 'hello' })
  )
  return self
}
export const AA = ({ children }) => ( Blue.r('div', null, children) )

// {

/*
  {
*/
export const BB = ({ children })=>{
  const reff = getRefs<{
    p: 'progress'
  }>()
  const pp = Blue.r(Brogress, null)
  const self = Blue.r('div', null, 
    Blue.r(Progress, { value: 5, max: 10, ref: [reff, 'p'] }),
    pp,
    children
  )
  const { p } = reff
p.value = 90
  const { unko, ahyo } = p
  unko.get(4)
  ahyo(345)
  p.hi.yo({
    u:56
  })

  pp.er = 90
  return self
}

document.body.append(Blue.r(AA, null))
`


const t0 = new Transformer(code)
// arrow functions into normal functions
t0.addTransform({
  regex: /export +(?:default|const (?<name>[A-Z]\w*) *=) *\((?<param>[\w, {}\[\]]*)\) *=>[ \n]*(?:{|(?<bstart>(?:\([ \n]*)?Blue.r\())/g,
  replaceWGroup({ name, param, bstart }) {
    let replacement = ''
    if (name) {
      replacement = `export function ${name}(${param}){`
    } else {
      replacement = `export default function(${param}){`
    }
    if (bstart) {
      replacement += ' const self =' + bstart
    }
    return replacement
  },
  addWGroup({ bstart }) {
    const adding = []
    if (bstart) {
      adding.push({
        adding: '; return self }',
        scope: Scope.SAME,
        place: CodePlace.AFTER
      })
    }
    return adding
  }
})

code = t0.transform();


const SELF_UPDATER = (self_name: string, expt_name: string) =>
  `//-----------------------------
if(import.meta.hot){
  ${self_name}.__canUpdate = true
  //---------------
  ${self_name}.__mod_props = new Map()
  ${self_name}.__prop_accessed = new Set()
  //---------------
  const p_handler = {
    get(target, prop){
      target.__prop_accessed.add(prop)
      return Reflect.get(...arguments);
    },
    set(target, prop, value) {
      target.__mod_props.set(prop, value)
      target[prop] = value;
      return true;
    }
  }
  ${self_name}.__newestElem = new Proxy(${self_name}, p_handler)
  
  import.meta.hot.accept(({ ${expt_name} })=>{
    if(!${self_name}.__canUpdate) import.meta.hot.decline()
    const newElem = Blue.r(${expt_name}, _bjsx_comp_attr, _bjsx_comp_attr.children)
    try{
      //---------------
      newElem.__mod_props = ${self_name}.__mod_props;
      for(const [key, value] of newElem.__mod_props.entries()){
        newElem[key] = value
      }
      newElem.__prop_accessed = ${self_name}.__prop_accessed
      for(const pname of newElem.__prop_accessed){
        if(newElem[pname] !== ${self_name}[pname]){
          
        }
      }
      //---------------
    } catch(_){
      import.meta.hot.decline()
    }
    ${self_name}.__newestElem = new Proxy(newElem, p_handler)
    ${self_name}.before(newElem)
    ${self_name}.remove()
  })
}
`
const t1 = new Transformer(code)
// move the function parameter
t1.addTransform({
  regex: /(?<rest>export(?: +default)? +function(?: +[A-Z]\w*)? *)\( *(?<param>{[\w, ]*}) *\) *\{/g,
  replaceWGroup({ rest }) {
    return `${rest}(_bjsx_comp_attr){`
  },
  addWGroup({ param }) {
    return [{
      adding: `let ${param} = _bjsx_comp_attr;`,
      scope: Scope.CHILD,
      place: CodePlace.START
    }]
  }
})
t1.addTransform({
  regex: /export(?: +default)? +function(?: +(?<name>[A-Z]\w*))? *\([\w{},: ]*\) *\{/g,
  nestWGroup({ name }, range) {
    /**
     * ```ts
     * elem.blahblah = 3
     * const { blah } = elem
     * blah(45)
     * ```
     * -->
     * ```ts
     * elem.__newestElem.blahblah = 3
     * const { blah } = elem
     * elem.__newestElem.blah(45)
     * ```
     */

    const modElem = (elem: string) => {
      t1.addTransform({
        regex: new RegExp(`[^\\w]${elem}\\s*\\.`, 'g'),
        replace: (match) => `${match[0]}__newestElem.`,
        // add(match){
        //   return [{
        //     adding: `__newestElem.`,
        //     scope: Scope.SAME,
        //     place: CodePlace.AFTER
        //   }]
        // }
      }, range)

      t1.addTransform({
        regex: new RegExp(`{(?<tookProp>[\\s,]+)} *= *${elem}`, 'g'),
        WGroup({ tookProp }) {
          tookProp.replace(/[\n ]+/g, '').split(',').forEach(prop => {
            t1.addTransform({
              regex: new RegExp(`[^\\w]${prop}\\s*\\.`, 'g'),
              replace(match) {
                return `${match[0]}__newestElem.`
              },
            }, range)
          })
        }
      }, range)
    }

    return [
      {
        regex: /return (?<self>\w+)/g,
        // places self-updater right before the return statement
        addWGroup({ self }) {
          return [{
            adding: SELF_UPDATER(self, name || 'default'),
            scope: Scope.SAME,
            place: CodePlace.BEFORE
          }]
        }
      },
      {
        regex: /(?:(?:const|let) +(?<varname>\w+) *= *)?(?<rest>Blue\.r\([A-Z]\w*)/g,
        // turn elements made from other Blue component updatable
        replaceWGroup({ varname, rest }) {
          if (varname) {
            return `let ${varname} = ${rest}`
          }
        },
        WGroup({ varname }) {
          if (varname) {
            t1.addTransform({
              regex: /return (?<self>\w+)/g,
              addWGroup({ self }) {
                if (varname === self) {
                  return [{
                    adding: `${self}.__canUpdate = false\n`,
                    scope: Scope.SAME,
                    place: CodePlace.BEFORE
                  }]
                }
                return []
              }
            }, range)
          }
        },
        nestWGroup({ varname }) {
          if (varname) {
            modElem(varname)
            return []
          } else {
            return [{
              regex: /ref: *\[ *[\w]+, *['"](?<refname>[\w]*)['"]\]/g,
              WGroup({ refname }) {
                modElem(refname)
              }
            }]
          }
        }
      },
    ]
  }
})

const result = t1.transform()
console.log(result)


// // elem.a.b = 45
// // elem.__add_mod_prop('a.b')
// t1.addTransform({
//   regex: new RegExp(`[^\\w]${elem}(?: |\\n)*\\.([.\\w \\n]+)=`, 'g'),
//   add: (match) => {
//     return [{
//       adding: `\n${elem}.__add_mod_prop("${match[1]}");`,
//       scope: Scope.SAME,
//       place: CodePlace.BEFORE
//     }]
//   }
// }, range)
// // elem.a.c(45)
// // elem.__add_func_passed('a.c', 45)
// t1.addTransform({
//   regex: new RegExp(`[^\\w]${elem}(?: |\\n)*\\.([.\\w \\n]+)\\(`, 'g'),
//   nest(match, range) {
//     let pass = ''

//     return [{
//       adding: `\n${elem}.__add_func_passed('${match[0]}', ${pass});`,
//       scope: Scope.SAME,
//       place: CodePlace.AFTER
//     }]
//   }
// }, range)