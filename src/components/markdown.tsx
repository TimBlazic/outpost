import { Fragment } from "react";

// Minimal markdown renderer for the playbook bodies.
// Supports: "## h2", "### h3", "- bullet", "1. numbered", **bold**, [[links]],
// and blank-line-separated paragraphs.
export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\n+/);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const lines = block.split("\n");

        if (lines[0].startsWith("## ")) {
          const [head, ...rest] = lines;
          return (
            <div key={i} className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {inline(head.slice(3))}
              </h2>
              {rest.length > 0 && <Lines lines={rest} />}
            </div>
          );
        }
        if (lines[0].startsWith("### ")) {
          const [head, ...rest] = lines;
          return (
            <div key={i} className="space-y-1.5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {inline(head.slice(4))}
              </h3>
              {rest.length > 0 && <Lines lines={rest} />}
            </div>
          );
        }
        return <Lines key={i} lines={lines} />;
      })}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  // bullet list
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul className="ml-1 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{inline(l.slice(2))}</span>
          </li>
        ))}
      </ul>
    );
  }
  // numbered list
  if (lines.every((l) => /^\d+\.\s/.test(l))) {
    return (
      <ol className="ml-1 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{i + 1}.</span>
            <span>{inline(l.replace(/^\d+\.\s/, ""))}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {lines.map((l, i) => (
        <Fragment key={i}>
          {inline(l)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </p>
  );
}

// Inline formatting: **bold** and [[wiki links]] (rendered as emphasis).
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("[[") && p.endsWith("]]")) {
      return (
        <em key={i} className="text-foreground not-italic underline decoration-dotted">
          {p.slice(2, -2).replace(/-/g, " ")}
        </em>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}
