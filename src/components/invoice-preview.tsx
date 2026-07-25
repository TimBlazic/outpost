import type { FirmSettings, Invoice } from "@/lib/data";
import { computeInvoiceTotals } from "@/lib/data";
import { formatAddressLines } from "@/lib/formatAddress";
import { signatureDisplayUrl } from "@/lib/invoices/signature-url";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateLong(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function fmtMoney(currency: string, n: number) {
  return `${currency} ${n.toFixed(2)}`;
}

/**
 * On-screen preview matching Harvey / pdf-lib invoice layout 1:1.
 */
export function InvoicePreview({
  invoice,
  settings,
  className,
}: {
  invoice: Invoice;
  settings: FirmSettings;
  className?: string;
}) {
  const customer = invoice.clientSnapshot;
  const companyDisplay =
    customer.companyName.trim() || customer.name.trim() || "—";
  const issuerCompany =
    settings.billingCompanyName.trim() ||
    settings.firmName.trim() ||
    "Your company name";
  const issuerPerson = settings.firmName.trim() || "Your name";

  const custLines = [
    ...formatAddressLines(customer.address),
    ...(customer.email ? [customer.email] : []),
    ...(customer.taxNumber || customer.vatId
      ? [`Tax: ${customer.taxNumber || customer.vatId}`]
      : []),
    ...(customer.registrationNumber
      ? [`Reg. no.: ${customer.registrationNumber}`]
      : []),
  ];

  const issLines = [
    ...(settings.iban ? [`IBAN: ${settings.iban}`] : []),
    ...(settings.bankName ? [`Bank: ${settings.bankName}`] : []),
    ...(settings.bic ? [`BIC: ${settings.bic}`] : []),
    ...(settings.registrationNumber
      ? [`Reg. no.: ${settings.registrationNumber}`]
      : []),
    ...(settings.taxNumber ? [`Tax no.: ${settings.taxNumber}`] : []),
    ...(settings.vatStatus.trim() ? [settings.vatStatus.trim()] : []),
  ];

  const { subtotal, taxTotal, total } = computeInvoiceTotals(invoice.lineItems);

  const taxDisclaimer =
    taxTotal > 0
      ? "Tax or VAT amounts are summarized above and included in the total where line items specify a tax rate."
      : settings.vatStatus.trim()
        ? "For your tax or VAT registration status, see the payment details section above."
        : "No VAT or sales tax is charged on this invoice based on the line items and rates shown.";

  const noteLines: string[] = [
    taxDisclaimer,
    "",
    ...(settings.iban && settings.bankName
      ? [`Pay to: ${settings.iban} (${settings.bankName})`, ""]
      : []),
    `Payment reference: Invoice No. ${invoice.invoiceNumber || "DRAFT"}`,
    "",
    "Please pay by the due date shown above.",
    "Late payments may incur interest or fees as allowed under your agreement or applicable law.",
    ...(invoice.notes.trim()
      ? ["", ...invoice.notes.trim().split("\n")]
      : []),
  ];

  const footerL = [
    formatAddressLines(settings.billingAddress).join(" ") ||
      settings.billingAddress.split("\n").join(", "),
    settings.billingEmail,
  ]
    .filter(Boolean)
    .join("  •  ");
  const footerR = [settings.billingPhone, settings.billingEmail]
    .filter(Boolean)
    .join("   ");

  const signatureSrc = signatureDisplayUrl(settings.signaturePath);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white text-[#111] shadow-md",
        className
      )}
    >
      <div className="p-8">
        {/* 1. HEADER */}
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
              INVOICE
            </p>
            <p className="mt-1 text-sm text-[#555]">
              DATE. {fmtDate(invoice.issueDate)}
            </p>
          </div>
        </div>

        {/* 2. GREY CARD */}
        <div className="mb-6 grid grid-cols-1 gap-0 rounded-lg bg-[#f5f5f5] p-5 md:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              INVOICE TO
            </p>
            <p className="text-sm font-bold text-[#111]">{companyDisplay}</p>
            <div className="mt-2 space-y-1">
              {custLines.map((line) => (
                <p key={line} className="text-[13px] text-[#555]">
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-6 md:mt-0">
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
              PAYMENT INFO
            </p>
            <p className="text-sm font-bold text-[#111]">{issuerCompany}</p>
            <div className="mt-2 space-y-1">
              {issLines.map((line) => (
                <p key={line} className="text-[13px] text-[#555]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* 3. DATE + NO */}
        <div className="mb-4">
          <p className="text-[13px] text-[#555]">
            DATE: {fmtDateLong(invoice.issueDate)}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#111]">
              INVOICE NO: {invoice.invoiceNumber ?? "DRAFT"}
            </p>
            <p className="text-sm text-[#555]">Due: {fmtDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* 4. ITEMS TABLE */}
        <div className="pt-1">
          <div className="grid grid-cols-12 gap-2 rounded-lg bg-[#f5f5f5] px-2 py-3 text-[11px] font-bold tracking-wide text-[#888] uppercase">
            <span className="col-span-1">NO</span>
            <span className="col-span-4">DESCRIPTION</span>
            <span className="col-span-1 text-right">QUANTITY</span>
            <span className="col-span-1 text-right">UNIT</span>
            <span className="col-span-2 text-right">UNIT PRICE</span>
            <span className="col-span-3 text-right">TOTAL</span>
          </div>
          {invoice.lineItems.map((line, i) => {
            const lineTotal = line.qty * line.unitPrice;
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-12 items-center gap-2 px-2 py-3 text-sm",
                  i < invoice.lineItems.length - 1 && "border-b border-[#eee]"
                )}
              >
                <span className="col-span-1 text-[#888]">{i + 1}</span>
                <span className="col-span-4 text-[#111]">
                  {line.description || "—"}
                </span>
                <span className="col-span-1 text-right tabular-nums text-[#555]">
                  {line.qty}
                </span>
                <span className="col-span-1 text-right text-[#555]">
                  {line.unit || "—"}
                </span>
                <span className="col-span-2 text-right tabular-nums text-[#555]">
                  {fmtMoney(invoice.currency, line.unitPrice)}
                </span>
                <span className="col-span-3 text-right font-bold tabular-nums text-[#111]">
                  {fmtMoney(invoice.currency, lineTotal)}
                </span>
              </div>
            );
          })}
        </div>

        {/* 5. TOTALS */}
        <div className="flex justify-end">
          <div className="min-w-[240px] space-y-2 text-right">
            {taxTotal > 0 ? (
              <>
                <div className="flex justify-between gap-6 text-sm text-[#555]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {fmtMoney(invoice.currency, subtotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-6 text-sm text-[#555]">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    {fmtMoney(invoice.currency, taxTotal)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex items-baseline justify-between gap-6 pt-2">
              <span className="text-sm font-bold text-[#111]">
                TOTAL AMOUNT PAYABLE IN {invoice.currency}:
              </span>
              <span className="text-sm font-bold tabular-nums text-[#111]">
                {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 6. NOTES */}
        <div className="mt-6 border-t border-[#ccc] pt-4">
          <div className="space-y-2 text-[13px] leading-relaxed text-[#555]">
            {noteLines.map((line, i) =>
              line === "" ? (
                <div key={`gap-${i}`} className="h-2" />
              ) : (
                <p key={`${i}-${line.slice(0, 24)}`}>{line}</p>
              )
            )}
          </div>
        </div>

        {/* 7. SIGNATURE */}
        <div className="mt-10 flex justify-end">
          <div className="w-[160px] text-center">
            {signatureSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureSrc}
                alt="Signature"
                className="mx-auto mb-2 h-10 w-[120px] object-contain"
              />
            ) : null}
            <div className="mb-2 border-b border-[#ccc]" />
            <p className="text-sm text-[#555]">{issuerPerson}</p>
          </div>
        </div>

        {/* 8. FOOTER */}
        <div className="mt-8 flex justify-between border-t border-[#ccc] pt-3 text-[11px] text-[#999]">
          <span className="max-w-[60%] truncate">{footerL}</span>
          <span>{footerR}</span>
        </div>
      </div>
    </div>
  );
}
