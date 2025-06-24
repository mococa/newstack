import { context } from "esbuild";
import { builder } from "@newstack/builder";

async function build() {
  console.time("Time taken");
  console.log("Building server...");

  const server = await context({
    ...builder.server,
    entryPoints: ["server.js"],
    minify: false,
    external: ["esbuild", "@newstack/builder"],
  });

  await server.rebuild();
  await server.dispose();

  console.log("Building client...");

  const client = await context({
    ...builder.client,
    entryPoints: ["client.js"],
    ignoreAnnotations: true,
    legalComments: "external",
    jsxSideEffects: false,
    minify: false,
    external: ["esbuild", "@newstack/builder"],
  });
  await client.rebuild();
  await client.dispose();

  console.log("Build completed successfully!");
  console.timeEnd("Time taken");
}

build();
