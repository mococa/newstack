import type { OnLoadArgs } from "esbuild";

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
  const classRegex = /class\s+(\w+)\s+extends\s+Newstack\s*{([\s\S]*?)}/g;
  const hashRegex = /static\s+hash\s*=\s*["'`](.+?)["'`]/;
  const methodRegex = /static\s+(async\s+)?(\w+)\s*\((.*?)\)\s*\{([\s\S]*?)\}/g;

  let updated = code;

  [...updated.matchAll(classRegex)].forEach(([fullClass, className, body]) => {
    const hashMatch = fullClass.match(hashRegex);
    if (!hashMatch) return;

    const hash = hashMatch[1];

    [...fullClass.matchAll(methodRegex)].forEach(
      ([fullMethod, asyncKeyword, methodName, paramStr]) => {
        const args = paramStr
          .split(",")
          .map((p) => p.trim().split("=")[0].trim())
          .filter(Boolean)
          .join(", ");

        const newMethod = `static ${asyncKeyword || ""}${methodName}(${paramStr}) {${replacer(
          {
            method: methodName,
            hash,
            args: `[${args}]`,
          },
        )}}`;

        updated = updated.replace(fullMethod, newMethod);
      },
    );
  });

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

        const result = await fetch(url, options).then((res) => res.json());
        return result;
    `;
}
