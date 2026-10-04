import type { Tag } from "../lib/types";
// Text comes from data only — there is deliberately no `children` prop.
export default function ProvenanceTag({ tag }: { tag: Tag }) {
  return <span className={`pill tag-${tag.toLowerCase()}`} title="Provenance (from manifest)">{tag}</span>;
}
