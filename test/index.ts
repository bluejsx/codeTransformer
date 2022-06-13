// import { assert, fail, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Transformer, Scope, CodePlace } from '../src/index.ts'



const code = `
apple {
  banana (
    orange{
      // } this should be ignored

      /*
        ) this should be ignored as well
      */
      ttt(a, b='default'){

        const txt = 'return 68'

        return a + b
      }
    },
    \`applepen {
      this area should be ignored as a comment
    }\`
  )
}
`;

const expect = `
apple {
  banana (
    orange{
      // } this should be ignored

      /*
        ) this should be ignored as well
      */
      ttt(a, b='default')// after ttt!
{

        const txt = 'return 68'

        return a + '!!!' + b
      }
    }// after orange!
,
    \`applepen {
      this area should be ignored as a comment
    }\`
  )// after banana!

}// after apple!
`
const t0 = new Transformer(code)

t0.addTransform({
  regex: /(?<name>\w+) *[{\(\[]/g,
  addWGroup({ name }){
    return [{
      adding: `// after ${name}!\n`,
      scope: Scope.SAME,
      place: CodePlace.AFTER
    }]
  }
})
t0.addTransform({
  regex: /return (?<name>\S+)/g,
  replaceWGroup({ name }){
    return `return ${name} + '!!!'`
  }
})


console.log(t0.transform().replace(/\s/g, '') === expect.replace(/\s/g, ''))
;

console.log(t0.transform())