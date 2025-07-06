import type { OnLoadArgs } from "esbuild";

const regexes = {
  class: /class\s+(\w+)\s+extends\s+Newstack\s*{([\s\S]*?)^}/gm,
  hash: /static\s+hash\s*=\s*["'`](.+?)["'`]/,
  method:
    /^(\s*)static\s+async\s+(\w+)\s*\(\s*(\w+|\{\s*\w+(?:\s*,\s*\w+)*\s*\})?\s*\)\s*\{([\s\S]*?)^\1}/gm,
};

/**
 * @kind Client
 *
 * @description
 * Goes through all classes that extend Newstack and
 * has static methods (server functions) and replaces
 * the content by a fetch call to `/api/newstack/{Component.Hash}/{methodName}`
 *
 * @returns {string} Updated code
 */
export function ReplaceStaticMethods(args: OnLoadArgs, code: string): string {
  let updated = code;

  for (const [_, className, body] of code.matchAll(regexes.class)) {
    const hash = body.match(regexes.hash)?.[1];
    if (!hash) continue;

    for (const [method, _, name, params] of body.matchAll(regexes.method)) {
      const newMethod = `static async ${name}(${params}) { ${replacer({ args: [params], method: name, hash })} }`;

      updated = updated.replace(method, newMethod);
    }
  }

  return updated;
}

function replacer({ args, method, hash }) {
  return `
        const url = "/api/newstack/${hash}/${method}";
        const options = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(${args}),
        };

        const { result, error } = await fetch(url, options).then((res) => res.json());
        if (error) throw new Error(error);

        return result;
    `;
}
