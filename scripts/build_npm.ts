import { build, emptyDir } from "https://deno.land/x/dnt@0.25.1/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/index.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@bluejsx/code-transformer",
    version: Deno.args[0],
    description: "TS/JS code transformer made for BlueJSX plugins",
    license: "MIT",
    repository: {
      type: "git",
      url: "git@github.com:bluejsx/codeTransformer.git",
    },
    bugs: {
      url: "https://github.com/bluejsx/codeTransformer/issues",
    },
  },
});

// post build steps
Deno.copyFileSync("README.md", "npm/README.md");