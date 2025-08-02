import type { OnLoadArgs } from "esbuild";
import crypto from "crypto";

/**
 * @todo
 * Implement AST
 *
 * @description
 * Based on each file path and class names, it goes through
 * every class that extends Newstack and add a static property
 * `hash`.
 *
 * @returns Hasher plugin
 */
export function Hasher(args: OnLoadArgs, code: string) {
  // Rough regex for classes extending Newstack without a static hash
  const classRegex =
    /class\s+([A-Za-z0-9_]+)\s+extends\s+Newstack\s*{([\s\S]*?)}/g;

  let didChange = false;
  const transformed = code.replace(classRegex, (full, className, body) => {
    if (/static\s+hash\s*=/.test(body)) return full; // already has hash

    const h = hash(`${args.path}:${className}`);
    didChange = true;

    return `class ${className} extends Newstack {\n${" ".repeat(2)}static hash = "${h}";\n${body}}`;
  });

  if (!didChange) return code;

  return transformed;
}

function hash(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}
