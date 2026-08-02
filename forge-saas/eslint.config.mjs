import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Kids Mode's clean-rollback guarantee (docs/kids-mode/03-architecture-and-data.md
    // §1, Audit §23) depends on adult code never importing from the kids
    // module — enforced here rather than remembered. Empty glob patterns
    // today: neither directory exists yet. This is the rule engaging the
    // moment they do, not a no-op waiting to be written later.
    files: ["src/app/**", "src/components/**", "src/lib/**"],
    ignores: ["src/app/kids/**", "src/app/parent/**", "src/lib/kids/**", "src/components/kids/**", "src/components/parent/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/kids/**", "@/lib/kids/**", "**/components/kids/**", "@/components/kids/**"],
              message:
                "Adult code must not import from the kids module (see docs/kids-mode/00-principles.md P5). This is what keeps Kids Mode independently removable.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
