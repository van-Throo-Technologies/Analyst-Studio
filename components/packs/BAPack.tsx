import type { Pack } from "../../lib/pack-generator";
import { PackHeader, PackSections } from "./PackSections";

/** The Business Analyst pack: the problem, the people, the boundaries, the rules. */
export function BAPack({ pack }: { pack: Pack }) {
  return (
    <div>
      <PackHeader pack={pack} />
      <PackSections pack={pack} />
    </div>
  );
}
