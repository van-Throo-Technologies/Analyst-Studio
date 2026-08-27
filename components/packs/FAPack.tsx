import type { Pack } from "../../lib/pack-generator";
import { PackHeader, PackSections } from "./PackSections";

/** The Functional Analyst pack: flows, preconditions, validations, criteria. */
export function FAPack({ pack }: { pack: Pack }) {
  return (
    <div>
      <PackHeader pack={pack} />
      <PackSections pack={pack} />
    </div>
  );
}
