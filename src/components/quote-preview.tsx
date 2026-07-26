import type { FirmSettings, Quote } from "@/lib/data";
import { stripQuoteMarkdown } from "@/lib/quotes/text";
import { cn } from "@/lib/utils";

function fmtDate(iso: string | null, locale: "sl" | "en") {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(
    locale === "sl" ? "sl-SI" : "en-GB",
    { day: "2-digit", month: "2-digit", year: "numeric" }
  );
}

function fmtDateLong(iso: string | null, locale: "sl" | "en") {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString(locale === "sl" ? "sl-SI" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function fmtMoney(n: number) {
  return `EUR ${n.toFixed(2)}`;
}

/**
 * On-screen preview matching the quote pdf-lib layout.
 */
export function QuotePreview({
  quote,
  settings,
  className,
}: {
  quote: Quote;
  settings: FirmSettings;
  className?: string;
}) {
  const sl = quote.locale === "sl";
  const L = {
    title: sl ? "PONUDBA" : "QUOTE",
    preparedFor: sl ? "PRIPRAVLJENO ZA" : "PREPARED FOR",
    from: sl ? "OD" : "FROM",
    date: sl ? "DATUM" : "DATE",
    number: sl ? "ŠT. PONUDBE" : "QUOTE NO",
    valid: sl ? "Veljavno do" : "Valid until",
    duration: sl ? "Trajanje projekta" : "Project duration",
    scope: sl ? "OBSEG" : "SCOPE",
    desc: sl ? "OPIS" : "DESCRIPTION",
    amount: sl ? "ZNESEK" : "AMOUNT",
    total: sl ? "SKUPAJ" : "TOTAL",
    vat: sl ? "Zneski vključujejo DDV" : "Amounts include VAT",
    notes: sl ? "OPOMBE" : "NOTES",
  };

  const scopeBody = stripQuoteMarkdown(quote.scope);
  const notesBody = stripQuoteMarkdown(quote.notes);

  const issuerCompany =
    settings.billingCompanyName.trim() ||
    settings.firmName.trim() ||
    settings.outboundFromName.trim() ||
    "Tim Blažič";
  const issuerPerson =
    settings.outboundFromName.trim() || settings.firmName.trim() || "Tim Blažič";
  const issuerEmail =
    settings.outboundFromEmail.trim() || settings.billingEmail.trim() || "";

  const recipient =
    quote.clientCompany.trim() || quote.clientName.trim() || "—";
  const leftLines = [
    ...(quote.clientName.trim() && quote.clientCompany.trim()
      ? [quote.clientName]
      : []),
    ...(quote.clientEmail.trim() ? [quote.clientEmail] : []),
  ];
  const rightLines = [
    "timblazic.dev",
    ...(issuerEmail ? [issuerEmail] : []),
    ...(issuerPerson !== issuerCompany ? [issuerPerson] : []),
  ];

  const dateIso = quote.sentAt?.slice(0, 10) ?? quote.createdAt.slice(0, 10);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white text-[#111] shadow-md",
        className
      )}
    >
      <div className="p-8">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#171614]"
              aria-hidden
            >
              <span className="size-[12px] rounded-full border-[2px] border-[#f7f4ee]" />
            </span>
            <p className="text-2xl font-bold tracking-tight text-[#111]">
              {issuerCompany}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-[#111]">
              {L.title}
            </p>
            <p className="mt-1 text-sm text-[#555]">
              {L.date}. {fmtDate(dateIso, quote.locale)}
            </p>
          </div>
        </div>

        {/* Grey card */}
        <div className="mb-6 grid grid-cols-1 gap-0 rounded-lg bg-[#f5f5f5] p-5 md:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              {L.preparedFor}
            </p>
            <p className="text-sm font-bold text-[#111]">{recipient}</p>
            <div className="mt-2 space-y-1">
              {leftLines.map((line) => (
                <p key={line} className="text-[13px] text-[#555]">
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-6 md:mt-0">
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              {L.from}
            </p>
            <p className="text-sm font-bold text-[#111]">{issuerCompany}</p>
            <div className="mt-2 space-y-1">
              {rightLines.map((line) => (
                <p key={line} className="text-[13px] text-[#555]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-6">
          <p className="text-[13px] text-[#555]">
            {L.date}: {fmtDateLong(dateIso, quote.locale)}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#111]">
              {L.number}: {quote.number || "—"}
            </p>
            {quote.validUntil ? (
              <p className="text-sm text-[#555]">
                {L.valid}: {fmtDate(quote.validUntil, quote.locale)}
              </p>
            ) : null}
          </div>
          {quote.projectDuration.trim() ? (
            <p className="mt-2 text-sm text-[#555]">
              {L.duration}: {quote.projectDuration.trim()}
            </p>
          ) : null}
        </div>

        {scopeBody.trim() ? (
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              {L.scope}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#555]">
              {scopeBody}
            </p>
          </div>
        ) : null}

        {/* Line items */}
        <div className="pt-1">
          <div className="grid grid-cols-12 gap-2 rounded-lg bg-[#f5f5f5] px-2 py-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
            <span className="col-span-1">NO</span>
            <span className="col-span-8">{L.desc}</span>
            <span className="col-span-3 text-right">{L.amount}</span>
          </div>
          {quote.lineItems.map((line, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-12 items-center gap-2 px-2 py-3 text-sm",
                i < quote.lineItems.length - 1 && "border-b border-[#eee]"
              )}
            >
              <span className="col-span-1 text-[#888]">{i + 1}</span>
              <span className="col-span-8 text-[#111]">
                {stripQuoteMarkdown(line.description || "—")}
              </span>
              <span className="col-span-3 text-right font-medium tabular-nums text-[#111]">
                {fmtMoney(line.amount)}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 flex flex-col items-end gap-1">
          <div className="flex min-w-[240px] items-baseline justify-between gap-6 text-sm font-bold">
            <span>{L.total} EUR:</span>
            <span className="tabular-nums">{quote.total.toFixed(2)}</span>
          </div>
          <p className="text-[12px] text-[#888]">{L.vat}</p>
        </div>

        {/* Notes */}
        {notesBody.trim() ? (
          <div className="mt-8 border-t border-[#ccc] pt-4">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              {L.notes}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#555]">
              {notesBody}
            </p>
          </div>
        ) : null}

        <div className="mt-10 border-t border-[#ccc] pt-3 text-[11px] text-[#999]">
          {issuerPerson} · timblazic.dev
        </div>
      </div>
    </div>
  );
}
