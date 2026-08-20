/**
 * Review scoping.
 *
 * Phases 3–8 are built and their routes still work — this flag only controls
 * what the UI *advertises*, so a Phase 1–2 review is not full of links to
 * screens that are out of scope for it.
 *
 * Phase 3+ nav is hidden during Phase 1-2 review. Restore after Phase 3 review
 * by setting this to true. Nothing else needs to change.
 */
export const SHOW_PHASE_3_PLUS_NAV = false;

/**
 * Extraction refuses to read material nobody has vouched for.
 *
 * Turned on in Phase 3. Enforced in three places, deliberately: the extraction
 * screen will not let an unvalidated source be selected, the server actions
 * check `canExtractProject` before spending anything, and `extractSources`
 * throws `UnvalidatedSourceError` at the last point before the model sees the
 * text. The UI check is a courtesy; the job's check is the guarantee.
 */
export const ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION = true;
