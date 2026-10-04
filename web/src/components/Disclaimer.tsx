export default function Disclaimer({ text }: { text?: string }) {
  return <footer className="disclaimer" role="note">{text ?? "Decision-support prototype — not an official IMD warning."}</footer>;
}
