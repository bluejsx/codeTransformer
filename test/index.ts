// import { assert, fail, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Transformer, Scope, CodePlace, assertObj } from '../src/index.ts'
// Deno.test({
//   name: "tr-1",
//   fn() {
//     assertEquals(1, 1)
//   }
// });



`const ppp = Blue.r(Comp2, { class: 'hello' })

// --- first scope ---
ppp.blahblah = 3

const { doThings } = ppp

doThings.apple(56)
// -----

self.onclick = () =>{
  // inner scope
  ppp.blahblah++
}

`;


`const ppp = Blue.r(Comp2, { class: 'hello' })

// --- first scope ---

ppp.blahblah = 3
ppp.__add_mod(ppp=>{ ppp.blahblah = 3 })
// rm: const { doThings } = ppp

ppp.doThings.apple(56)
ppp.__add_mod(ppp=>{ ppp.doThings.apple(56) })

// -----

self.onclick = () =>{
  // inner func scope
  ppp.__newestElem.blahblah++
}
`;


`const ppp = Blue.r(Comp2, { class: 'hello' })

ppp.blahblah = 3
ppp.__add_mod(ppp=>{ ppp.blahblah = 3 })

const { doThings } = ppp

doThings.apple(56)`;


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
  c2.
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
export const AA = ({ children }) => Blue.r('div', null, children)

// {

/*
  {
*/
export function BB({ children }){
  const reff = getRefs<{
    p: 'progress'
  }>()
  const self = Blue.r('div', null, 
    Blue.r(Progress, { value: 5, max: 10, ref: [reff, 'p'] }),
    children
  )
  const { p } = reff
  p.value = 90
  return self
}

document.body.append(Blue.r(AA, null))
`
export default () => { }
export const Unko = () => { }
const Unko2 = () => { }

export { Unko2 }

const t0 = new Transformer(code)
// arrow functions into normal functions
t0.addTransform({
  regex: /export +(?:(?:default)|(?:const (?<name>[A-Z]\w*) *=)) +\((?<param>[\w, {}\[\]]*)\) *=> *\n? *(?:(?<bracket>{)|(?:Blue.r\())/g,
  replaceWGroup({ name, param, bracket }) {
    let replacement = ''
    if (name) {
      replacement = `export function ${name}(${param}){`
    } else {
      replacement = `export default function(${param}){`
    }
    if (!bracket) {
      replacement += ' const self = Blue.r('
    }
    return replacement
  },
  addWGroup({ bracket }) {
    const adding = []
    if (!bracket) {
      adding.push({
        adding: '; return self }',
        scope: Scope.SAME,
        place: CodePlace.AFTER
      })
    }
    return adding
  }
})

code = t0.transform()


const SELF_UPDATER = (expt_name: string) =>
  `if(import.meta.hot){
  self.__newestElem = self
  import.meta.hot.accept(({ ${expt_name} })=>{
    const newElem = Blue.r(default, _bjsx_comp_attr, _bjsx_comp_attr.children)
    self.__newestElem = newElem
    self.before(newElem)
    self.remove()
  })
}
`
const t1 = new Transformer(code)
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
    return [
      {
        regex: /return \w+/g,
        add() {
          return [{
            adding: SELF_UPDATER(name || 'default'),
            scope: Scope.SAME,
            place: CodePlace.BEFORE
          }]
        }
      },
      {
        regex: /ref: *\[ *[\w]+, *['"](?<name>[\w]*)['"]\]/g,
        WGroup({ name }) {
          t1.addTransform({
            regex: new RegExp(`[^\w]${name}\\.`, 'g'),
            replace: (match) => `${match[0]}__newestElem.`
          }, range)
        }

      }
    ]
  }
})

const result = t1.transform()
console.log(result)
