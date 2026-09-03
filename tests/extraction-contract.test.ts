/**
 * Guards the single source of truth for the extraction contract.
 *
 * Two code paths ask the model to turn documents into records — the in-app
 * pipeline in lib/extract-core.ts and the corpus builder in
 * scripts/extract-documents.ts. They had each grown their own copy of the
 * grounding rules and their own record-type and priority enums, which is how
 * the two quietly stopped agreeing.
 *
 * These tests fail if a copy comes back. They are deliberately source-level:
 * the failure being prevented is someone pasting the sentence inline again,
 * and only reading the file catches that.
 *
 * Usage: npx tsx tests/extraction-contract.test.ts
 */

import fs from "node:fs";

import {
  precisionContract,
  quotingRule,
  literalMatchContract,
  KIND_DEFINITIONS,
} from "../lib/extraction-contract";
import { RECORD_TYPES, PRIORITIES } from "../lib/constants";

const CORE = "lib/extract-core.ts";
const SCRIPT = "scripts/extract-documents.ts";
const ROUTE = "app/api/features/rules/route.ts";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok    ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const core = fs.readFileSync(CORE, "utf8");
const script = fs.readFileSync(SCRIPT, "utf8");
const route = fs.readFileSync(ROUTE, "utf8");

console.log("Extraction contract — single source of truth\n");

// --- the contract is stated once ------------------------------------------

// The literal-match promise is the load-bearing sentence: it is what tells the
// model its quote will be tested. If either prompt states it inline, the two
// can drift and one path can quietly stop making the promise.
const MATCH_SENTENCE = "is checked against the source by literal string match";
for (const [label, src] of [["extract-core", core], ["script", script]] as const) {
  const inline = src.split("\n").filter(
    (line) => line.includes(MATCH_SENTENCE) && !line.includes("literalMatchContract"),
  );
  check(
    `${label} does not inline the literal-match promise`,
    inline.length === 0,
    inline[0]?.trim().slice(0, 80),
  );
}

// Same for the precision rule and the quoting instruction.
for (const [label, src] of [["extract-core", core], ["script", script]] as const) {
  check(
    `${label} does not inline "Precision comes from the source"`,
    !src.includes("Precision comes from the source, never from you. Where"),
  );
  check(
    `${label} does not inline the copy-exactly instruction`,
    !src.includes("Copy the exact characters as they appear — do not paraphrase"),
  );
}

// --- the enums are read, not restated -------------------------------------

// A second copy of the record-type list is how the rules API and the extractor
// came to disagree about whether "feature" was queryable.
const RECORD_TYPE_LITERAL = /"business-rule",\s*\n\s*"regulatory-constraint"/;
for (const [label, src] of [
  ["script", script],
  ["rules route", route],
  ["extract-core", core],
] as const) {
  check(
    `${label} does not restate RECORD_TYPES`,
    !RECORD_TYPE_LITERAL.test(src),
  );
}

check(
  "script does not restate PRIORITIES",
  !/z\.enum\(\[\s*"High"/.test(script),
);

// --- the shared definitions still say what the callers rely on ------------

check(
  "precisionContract names the field when given one",
  precisionContract({ recordVaguenessIn: "validationGates" }).includes(
    "record the missing decision in validationGates",
  ),
);

check(
  "precisionContract omits the field when there is none",
  !precisionContract().includes("record the missing decision"),
);

check(
  "quotingRule carries the copy-exactly rule",
  quotingRule({ field: "quote", lead: "one VERBATIM quote" }).includes(
    "do not tidy the grammar",
  ),
);

check(
  "literalMatchContract keeps the caller's consequence",
  literalMatchContract({ subject: "The quote", consequence: "Discarded." }).endsWith(
    "Discarded.",
  ),
);

// Every kind the script can emit needs a definition, except acceptance-criteria
// — the in-app pipeline carries those as fields on a feature rather than as
// their own record, so there is nothing shared to define.
for (const kind of RECORD_TYPES) {
  if (kind === "acceptance-criteria") continue;
  check(
    `KIND_DEFINITIONS covers "${kind}"`,
    kind in KIND_DEFINITIONS,
  );
}

check("PRIORITIES is non-empty", PRIORITIES.length > 0);

// --- both paths actually compose from the shared module -------------------

check(
  "extract-core imports the contract",
  core.includes('from "./extraction-contract"'),
);
check(
  "script imports the contract",
  script.includes('from "../lib/extraction-contract"'),
);

// The script runs under tsx, where "server-only" throws on import. If the
// shared module ever picks it up — directly or through an import — the corpus
// builder stops working, which is the failure that caused the duplication.
// Matches an import statement, not the word: the module's own comment explains
// why it must not carry server-only, and a substring check flagged that prose.
const contract = fs.readFileSync("lib/extraction-contract.ts", "utf8");
check(
  "the contract module does not import server-only",
  !/^\s*import\s+["']server-only["']/m.test(contract),
);
check(
  "the contract module imports nothing at all",
  !/^\s*import\s/m.test(contract),
);

console.log(`\n${passed}/${passed + failures.length} passed`);
if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
