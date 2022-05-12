import { assert, fail, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Transformer, Scope, CodePlace, assertObj } from '../src/index.ts'
// Deno.test({
//   name: "tr-1",
//   fn() {
//     assertEquals(1, 1)
//   }
// });

`
import Comp from '../file'

export default (_bjsx_comp_attr)=>{
  let { attr1, children } = _bjsx_comp_attr
  const refs = {}
  const self = Blue.r('div', null, 
    Blue.r(Comp, {ref: [refs, 'bjsx_ref_0'], class: 'hello'})
  )
  if(import.meta.hot){
    self._bjsx_hmr_update = (Comp, attr) =>{
      const newElem = Blue.r(Comp, attr, _bjsx_comp_attr.children)
      self.before(newElem)
      self.remove()
      return newElem
    }
    import.meta.hot.accept('../file.tsx', ({default: Comp})=>{
      refs.bjsx_ref_0 = refs.bjsx_ref_0._bjsx_hmr_update(Comp, {class: 'hello'})
    })
  }
  return self
}`;

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
      self.before(newElem)
      self.remove()
      self.__newestElem = newElem
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
`
const t0 = new Transformer(code)
t0.addTransform({
  regex: /\) *=> *\n? *Blue.r\(/g,
  replace() {
    return ')=>{ const self = Blue.r('
  },
  add() {
    return [{
      adding: '; return self }',
      scope: Scope.SAME,
      place: CodePlace.AFTER
    }]
  }
})
t0.addTransform({
  regex: /function *(?<name>[A-Z][\w]*)\((?<param>[\w, {}\[\]]*)\)/g,
  replace(match) {
    const { groups } = match
    assertObj(groups)
    return `const ${groups.name} = (${groups.param}) =>`
  }
})
code = t0.transform()

const t1 = new Transformer(code)
t1.addTransform({
  regex: /\( *(?<param>{[\w, ]*}) *\) *=> *\{/g,
  replace(_) {
    return "(_bjsx_comp_attr)=>{"
  },
  addWGroup(groups) {
    return [{
      adding: `let ${groups.param} = _bjsx_comp_attr;`,
      scope: Scope.CHILD,
      place: CodePlace.START
    }]
  }
})
t1.addTransform({
  regex: /Blue.r\(([A-Z][\w]*), \)/g,

})
t1.addTransform({
  regex: /ref: *\[ *(?<refs>[\w]+), *['"](?<name>[\w]*)['"]\]/g,
  addWGroup(groups){
    const { refs, name } = groups

    t1.addTransform({
      regex: new RegExp(``),
      replace: () => ``
    })

    return []
  }

})

const result = t1.transform()
console.log(result)