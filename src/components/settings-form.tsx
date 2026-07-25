"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FirmSettings } from "@/lib/data";
import { DEFAULT_AI_EMAIL_SYSTEM_PROMPT } from "@/lib/ai/default-email-prompt";
import { updateFirmSettings } from "@/lib/actions";
import {
  clearInvoiceSignature,
  uploadInvoiceSignature,
} from "@/lib/invoices/actions";
import { signatureDisplayUrl } from "@/lib/invoices/signature-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SettingsSection = "studio" | "billing" | "ai";

export function SettingsForm({
  settings,
  section,
}: {
  settings: FirmSettings;
  section: SettingsSection;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firmName, setFirmName] = useState(settings.firmName);
  const [revenueGoal, setRevenueGoal] = useState(String(settings.revenueGoal));
  const currentYear = new Date().getFullYear();

  const [billingCompanyName, setBillingCompanyName] = useState(
    settings.billingCompanyName
  );
  const [billingAddress, setBillingAddress] = useState(settings.billingAddress);
  const [billingEmail, setBillingEmail] = useState(settings.billingEmail);
  const [billingPhone, setBillingPhone] = useState(settings.billingPhone);
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber);
  const [vatId, setVatId] = useState(settings.vatId);
  const [vatStatus, setVatStatus] = useState(settings.vatStatus);
  const [registrationNumber, setRegistrationNumber] = useState(
    settings.registrationNumber
  );
  const [iban, setIban] = useState(settings.iban);
  const [bic, setBic] = useState(settings.bic);
  const [bankName, setBankName] = useState(settings.bankName);
  const [issuePlace, setIssuePlace] = useState(settings.issuePlace);
  const [defaultCurrency, setDefaultCurrency] = useState(
    settings.defaultCurrency
  );
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(
    String(settings.defaultPaymentTermsDays)
  );
  const [signaturePath, setSignaturePath] = useState(settings.signaturePath);
  const [aiEmailSystemPrompt, setAiEmailSystemPrompt] = useState(
    settings.aiEmailSystemPrompt || DEFAULT_AI_EMAIL_SYSTEM_PROMPT
  );
  const [saved, setSaved] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);

  function buildSettings(): FirmSettings {
    // Start from server props so other tabs' unsaved/stale local state can't clobber.
    const next: FirmSettings = { ...settings, goalYear: currentYear };
    if (section === "studio") {
      next.firmName = firmName.trim() || "Studio";
      next.revenueGoal = Number(revenueGoal) || 0;
    }
    if (section === "billing") {
      next.billingCompanyName = billingCompanyName;
      next.billingAddress = billingAddress;
      next.billingEmail = billingEmail;
      next.billingPhone = billingPhone;
      next.taxNumber = taxNumber;
      next.vatId = vatId;
      next.vatStatus = vatStatus;
      next.registrationNumber = registrationNumber;
      next.iban = iban;
      next.bic = bic;
      next.bankName = bankName;
      next.issuePlace = issuePlace;
      next.signaturePath = signaturePath;
      next.defaultCurrency = defaultCurrency;
      next.defaultPaymentTermsDays = Number(defaultPaymentTermsDays) || 14;
    }
    if (section === "ai") {
      next.aiEmailSystemPrompt =
        aiEmailSystemPrompt.trim() === DEFAULT_AI_EMAIL_SYSTEM_PROMPT.trim()
          ? ""
          : aiEmailSystemPrompt;
    }
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateFirmSettings(buildSettings());
      setSaved(true);
      router.refresh();
    });
  }

  function handleSignatureUpload(file: File | null) {
    if (!file) return;
    setSigError(null);
    const fd = new FormData();
    fd.set("signature", file);
    startTransition(async () => {
      try {
        const path = await uploadInvoiceSignature(fd);
        setSignaturePath(path);
        router.refresh();
      } catch (e) {
        setSigError(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  function handleClearSignature() {
    setSigError(null);
    startTransition(async () => {
      try {
        await clearInvoiceSignature();
        setSignaturePath(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (e) {
        setSigError(e instanceof Error ? e.message : "Could not clear");
      }
    });
  }

  const signaturePreview = signatureDisplayUrl(signaturePath);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {section === "studio" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Studio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="firmName" className="mb-1.5">
                Your name
              </Label>
              <Input
                id="firmName"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Tim Blažič"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Used on the invoice signature line and as the AI email sign-off.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="revenueGoal" className="mb-1.5">
                {currentYear} revenue goal (€)
              </Label>
              <Input
                id="revenueGoal"
                type="number"
                min={0}
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Dashboard collected uses paid invoices. “Projects to go” uses the
                average value of your active projects.
              </p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 border-t border-border/70 pt-4">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600">Saved</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "billing" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice / Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="billingCompanyName" className="mb-1.5">
                Company name
              </Label>
              <Input
                id="billingCompanyName"
                value={billingCompanyName}
                onChange={(e) => setBillingCompanyName(e.target.value)}
                placeholder="Programiranje, Tim Blažič s.p."
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Shown in the invoice header and payment info block.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="billingAddress" className="mb-1.5">
                Address
              </Label>
              <Textarea
                id="billingAddress"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                rows={2}
                placeholder="Street, postcode city, country"
              />
            </div>
            <div>
              <Label htmlFor="billingEmail" className="mb-1.5">
                Email
              </Label>
              <Input
                id="billingEmail"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="billingPhone" className="mb-1.5">
                Phone
              </Label>
              <Input
                id="billingPhone"
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxNumber" className="mb-1.5">
                Tax number
              </Label>
              <Input
                id="taxNumber"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vatId" className="mb-1.5">
                VAT ID
              </Label>
              <Input
                id="vatId"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vatStatus" className="mb-1.5">
                VAT status
              </Label>
              <Input
                id="vatStatus"
                value={vatStatus}
                onChange={(e) => setVatStatus(e.target.value)}
                placeholder="e.g. Not liable for VAT"
              />
            </div>
            <div>
              <Label htmlFor="registrationNumber" className="mb-1.5">
                Registration number
              </Label>
              <Input
                id="registrationNumber"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="issuePlace" className="mb-1.5">
                Issue place
              </Label>
              <Input
                id="issuePlace"
                value={issuePlace}
                onChange={(e) => setIssuePlace(e.target.value)}
                placeholder="Ljubljana"
              />
            </div>
            <div>
              <Label htmlFor="iban" className="mb-1.5">
                IBAN
              </Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bic" className="mb-1.5">
                BIC
              </Label>
              <Input
                id="bic"
                value={bic}
                onChange={(e) => setBic(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bankName" className="mb-1.5">
                Bank name
              </Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
                Numbering
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Issued as{" "}
                <span className="font-medium text-foreground">YY-NNNN</span>{" "}
                from the issue year — e.g. 2026 →{" "}
                <span className="font-medium text-foreground">26-0001</span>.
              </p>
            </div>
            <div>
              <Label htmlFor="defaultPaymentTermsDays" className="mb-1.5">
                Default payment terms (days)
              </Label>
              <Input
                id="defaultPaymentTermsDays"
                type="number"
                min={0}
                value={defaultPaymentTermsDays}
                onChange={(e) => setDefaultPaymentTermsDays(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="defaultCurrency" className="mb-1.5">
                Default currency
              </Label>
              <Select
                id="defaultCurrency"
                value={defaultCurrency}
                onChange={(e) =>
                  setDefaultCurrency(
                    e.target.value as FirmSettings["defaultCurrency"]
                  )
                }
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="signature" className="mb-1.5">
                Signature
              </Label>
              {signaturePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signaturePreview}
                  alt="Signature"
                  className="h-14 w-auto rounded border border-border bg-white object-contain p-1"
                />
              ) : signaturePath ? (
                <p className="text-sm text-muted-foreground">
                  Signature on file
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No signature uploaded
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  ref={fileRef}
                  id="signature"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="max-w-xs"
                  onChange={(e) =>
                    handleSignatureUpload(e.target.files?.[0] ?? null)
                  }
                />
                {signaturePath ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={handleClearSignature}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {sigError ? (
                <p className="text-sm text-rose-600">{sigError}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 border-t border-border/70 pt-4">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save billing"}
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600">Saved</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "ai" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI email prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              System prompt for Generate email on leads. Lead data, intent, and
              your brief are injected automatically. Uses Claude Sonnet via{" "}
              <code className="text-xs">ANTHROPIC_API_KEY</code>.
            </p>
            <div>
              <Label htmlFor="aiEmailSystemPrompt" className="mb-1.5">
                System prompt
              </Label>
              <Textarea
                id="aiEmailSystemPrompt"
                value={aiEmailSystemPrompt}
                onChange={(e) => setAiEmailSystemPrompt(e.target.value)}
                rows={18}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save prompt"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  setAiEmailSystemPrompt(DEFAULT_AI_EMAIL_SYSTEM_PROMPT)
                }
              >
                Reset to default
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600">Saved</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </form>
  );
}
