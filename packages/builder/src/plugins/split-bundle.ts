import type { Plugin } from "esbuild";

/**
 * @description
 * This plugin is meant to allow esbuild to split the bundle in dynamic imports.
 *
 * @return {Plugin}
 */
export function SplitBundle(): Plugin {
  return {
    name: "split-bundle",
    setup(build) {
      build.initialOptions.splitting = true;
    },
  };
}
