"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { completeClientOnboardingAction } from "@/lib/client-accounts/onboarding-actions";
import {
  normalizePortalLocale,
  portalT,
  type PortalLocale,
} from "@/lib/portal/i18n";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OnboardingDefaults = {
  firstName: string;
  lastName: string;
  company: string;
  billingAddress: string;
  taxNumber: string;
  vatId: string;
  registrationNumber: string;
  billingKind: "person" | "company";
  profileName: string;
  profileAvatarUrl: string | null;
  profileInitials: string;
};

type AddressParts = {
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

/** Stored as comma-separated for invoice formatting (`formatAddressLines`). */
function joinBillingAddress(parts: AddressParts) {
  const cityLine = [parts.postalCode.trim(), parts.city.trim()]
    .filter(Boolean)
    .join(" ");
  return [parts.street.trim(), cityLine, parts.country.trim()]
    .filter(Boolean)
    .join(", ");
}

function parseBillingAddress(raw: string): AddressParts {
  const empty = { street: "", postalCode: "", city: "", country: "" };
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return empty;
  if (parts.length === 1) return { ...empty, street: parts[0] };
  if (parts.length === 2) {
    return { ...empty, street: parts[0], country: parts[1] };
  }

  const street = parts[0];
  const country = parts[parts.length - 1];
  const middle = parts.slice(1, -1).join(", ");
  const match = middle.match(/^(\d[\w-]*)\s+(.+)$/);
  if (match) {
    return {
      street,
      postalCode: match[1],
      city: match[2],
      country,
    };
  }
  return { street, postalCode: "", city: middle, country };
}

const fieldControlClass =
  "rounded-md border border-[var(--portal-line)] bg-[var(--portal-bg)] px-3 shadow-none focus-visible:border-[var(--portal-fg)] focus-visible:ring-0";

function Field({
  label,
  htmlFor,
  children,
  hint,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--portal-muted)]"
      >
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-xs text-[var(--portal-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function ClientOnboardingForm({
  defaults,
  locale = "en",
}: {
  defaults: OnboardingDefaults;
  locale?: PortalLocale | string;
}) {
  const router = useRouter();
  const t = portalT(normalizePortalLocale(locale));
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [lastName, setLastName] = useState(defaults.lastName);
  const [billingKind, setBillingKind] = useState<"person" | "company">(
    defaults.billingKind
  );
  const [company, setCompany] = useState(defaults.company);
  const [address, setAddress] = useState<AddressParts>(() =>
    parseBillingAddress(defaults.billingAddress)
  );
  const [taxNumber, setTaxNumber] = useState(defaults.taxNumber);
  const [vatId, setVatId] = useState(defaults.vatId);
  const [registrationNumber, setRegistrationNumber] = useState(
    defaults.registrationNumber
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const fullName = `${firstName} ${lastName}`.trim() || defaults.profileName;
  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  function onPickAvatar(fileList: FileList | null) {
    const next = fileList?.[0] ?? null;
    if (!next) return;
    setAvatarFile(next);
    setAvatarPreview(URL.createObjectURL(next));
  }

  function patchAddress(patch: Partial<AddressParts>) {
    setAddress((prev) => ({ ...prev, ...patch }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 2) return;
    if (!canContinue) return;
    if (!address.street.trim()) {
      setError(t.errStreetRequired);
      return;
    }
    if (!address.postalCode.trim()) {
      setError(t.errPostalRequired);
      return;
    }
    if (!address.city.trim()) {
      setError(t.errCityRequired);
      return;
    }
    if (!address.country.trim()) {
      setError(t.errCountryRequired);
      return;
    }
    if (billingKind === "company" && !company.trim()) {
      setError(t.errCompanyRequired);
      return;
    }

    const billingAddress = joinBillingAddress(address);

    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("firstName", firstName.trim());
        fd.set("lastName", lastName.trim());
        fd.set("billingKind", billingKind);
        fd.set("company", company.trim());
        fd.set("billingAddress", billingAddress);
        fd.set("taxNumber", taxNumber.trim());
        fd.set("vatId", vatId.trim());
        fd.set("registrationNumber", registrationNumber.trim());
        if (avatarFile) fd.set("avatar", avatarFile);

        await completeClientOnboardingAction(fd);
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t.errOnboardingFailed
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-10">
      <div className="space-y-3 text-center">
        <p className="text-[11px] tracking-[0.22em] uppercase text-[var(--portal-muted)]">
          {t.onboardingEyebrow}
        </p>
        <h1 className="portal-display text-5xl italic leading-none">
          {t.onboardingWelcome}
        </h1>
        <p className="text-sm text-[var(--portal-muted)]">
          {step === 1 ? t.onboardingStepYouHint : t.onboardingStepInvoiceHint}
        </p>
        <div className="mx-auto flex w-24 items-center gap-1.5 pt-1">
          <span
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors",
              step === 1 ? "bg-[var(--portal-fg)]" : "bg-[var(--portal-line)]"
            )}
          />
          <span
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors",
              step === 2 ? "bg-[var(--portal-fg)]" : "bg-[var(--portal-line)]"
            )}
          />
        </div>
      </div>

      <section className="space-y-8 border-t border-[var(--portal-line)] pt-8">
        {step === 1 ? (
          <>
            <div className="space-y-1">
              <h2 className="portal-display text-3xl italic leading-none">
                {t.onboardingYouTitle}
              </h2>
              <p className="text-sm text-[var(--portal-muted)]">
                {t.onboardingYouBody}
              </p>
            </div>

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative shrink-0 rounded-full"
                title={t.onboardingUploadPhoto}
              >
                <UserAvatar
                  name={fullName}
                  avatarUrl={avatarPreview ?? defaults.profileAvatarUrl}
                  initials={defaults.profileInitials}
                  size="lg"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </span>
              </button>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickAvatar(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm underline decoration-[var(--portal-line)] underline-offset-4 hover:text-[var(--portal-fg)]"
                >
                  {t.onboardingUploadPhoto}
                  <span className="text-[var(--portal-muted)] no-underline">
                    {" "}
                    {t.onboardingOptional}
                  </span>
                </button>
                <p className="text-xs text-[var(--portal-muted)]">
                  {t.onboardingPhotoHint}
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label={t.onboardingFirstName} htmlFor="firstName">
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
              <Field label={t.onboardingLastName} htmlFor="lastName">
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                disabled={!canContinue || pending}
                className="h-11 min-w-[8.5rem]"
              >
                {t.onboardingContinue}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h2 className="portal-display text-3xl italic leading-none">
                {t.onboardingInvoiceTitle}
              </h2>
              <p className="text-sm text-[var(--portal-muted)]">
                {t.onboardingInvoiceBody}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--portal-muted)]">
                {t.onboardingInvoiceAs}
              </p>
              <div className="flex gap-6">
                {(
                  [
                    ["person", t.onboardingPerson],
                    ["company", t.onboardingCompany],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBillingKind(value)}
                    disabled={pending}
                    className={cn(
                      "border-b-2 pb-1 text-sm transition-colors",
                      billingKind === value
                        ? "border-[var(--portal-fg)] text-[var(--portal-fg)]"
                        : "border-transparent text-[var(--portal-muted)] hover:text-[var(--portal-fg)]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {billingKind === "company" ? (
              <Field label={t.onboardingCompanyName} htmlFor="company">
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required={billingKind === "company"}
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
            ) : null}

            <div className="space-y-6">
              <Field label={t.onboardingStreet} htmlFor="street">
                <Input
                  id="street"
                  value={address.street}
                  onChange={(e) => patchAddress({ street: e.target.value })}
                  autoComplete="street-address"
                  required
                  placeholder={t.onboardingStreetPlaceholder}
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
              <div className="grid gap-6 sm:grid-cols-3">
                <Field label={t.onboardingPostal} htmlFor="postalCode">
                  <Input
                    id="postalCode"
                    value={address.postalCode}
                    onChange={(e) => patchAddress({ postalCode: e.target.value })}
                    autoComplete="postal-code"
                    required
                    placeholder="1000"
                    className={cn("h-11", fieldControlClass)}
                  />
                </Field>
                <Field label={t.onboardingCity} htmlFor="city" className="sm:col-span-2">
                  <Input
                    id="city"
                    value={address.city}
                    onChange={(e) => patchAddress({ city: e.target.value })}
                    autoComplete="address-level2"
                    required
                    className={cn("h-11", fieldControlClass)}
                  />
                </Field>
              </div>
              <Field label={t.onboardingCountry} htmlFor="country">
                <Input
                  id="country"
                  value={address.country}
                  onChange={(e) => patchAddress({ country: e.target.value })}
                  autoComplete="country-name"
                  required
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label={t.onboardingTaxNumber} htmlFor="taxNumber">
                <Input
                  id="taxNumber"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
              <Field label={t.onboardingVatId} htmlFor="vatId">
                <Input
                  id="vatId"
                  value={vatId}
                  onChange={(e) => setVatId(e.target.value)}
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
              <Field
                label={t.onboardingRegNumber}
                htmlFor="registrationNumber"
                className="sm:col-span-2"
              >
                <Input
                  id="registrationNumber"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className={cn("h-11", fieldControlClass)}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={pending}
                className="text-[var(--portal-muted)]"
              >
                {t.onboardingBack}
              </Button>
              <Button type="submit" disabled={pending} className="h-11 min-w-[8.5rem]">
                {pending ? t.onboardingSaving : t.onboardingFinish}
              </Button>
            </div>
          </>
        )}
      </section>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
