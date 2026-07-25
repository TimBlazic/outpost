"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";

import type { Client } from "@/lib/data";
import { createClient, updateClient } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = Boolean(client);
  const portalLinked = Boolean(client?.authUserId);
  const [createPortalAccount, setCreatePortalAccount] = useState(false);
  const [contactEmail, setContactEmail] = useState(client?.email ?? "");
  const [portalEmail, setPortalEmail] = useState(
    client?.portalEmail || client?.email || ""
  );
  const [portalLocale, setPortalLocale] = useState<"en" | "sl">(
    client?.portalLocale === "sl" ? "sl" : "en"
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const back = client ? `/clients/${client.id}` : "/clients";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const val = (id: string) =>
      (f.namedItem(id) as HTMLInputElement | HTMLTextAreaElement | null)
        ?.value ?? "";

    const termsRaw = val("paymentTermsDays").trim();
    const input = {
      name: val("name").trim(),
      email: contactEmail.trim(),
      phone: val("phone").trim(),
      company: val("company").trim() || val("name").trim(),
      website: val("website").trim(),
      country: val("country").trim(),
      notes: val("notes"),
      leadId: client?.leadId,
      billingAddress: val("billingAddress").trim(),
      taxNumber: val("taxNumber").trim(),
      vatId: val("vatId").trim(),
      registrationNumber: val("registrationNumber").trim(),
      paymentTermsDays: termsRaw === "" ? null : Number(termsRaw) || null,
      createPortalAccount,
      portalEmail: portalEmail.trim(),
      portalLocale,
    };

    setSubmitError(null);
    startTransition(async () => {
      try {
        if (client) {
          await updateClient(client.id, input);
          router.push(`/clients/${client.id}`);
        } else {
          const id = await createClient(input);
          router.push(`/clients/${id}`);
        }
        router.refresh();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Failed to save client."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 lg:p-6">
      <Link
        href={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editing ? "Edit client" : "New client"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Update client contact details."
              : "Add a client to attach projects and portal access."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={back}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {editing ? "Save changes" : "Create client"}
          </Button>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              defaultValue={client?.name}
              placeholder="Acme Inc."
              required
            />
          </Field>
          <Field label="Company" htmlFor="company">
            <Input
              id="company"
              name="company"
              defaultValue={client?.company}
              placeholder="Legal / trading name"
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input
              id="country"
              name="country"
              defaultValue={client?.country}
              placeholder="SI"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hello@acme.example"
            />
            {portalLinked ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Portal account linked.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="createPortalAccount"
                    checked={createPortalAccount}
                    disabled={pending}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setCreatePortalAccount(next);
                      if (
                        next &&
                        !editing &&
                        !portalEmail.trim() &&
                        contactEmail.trim()
                      ) {
                        setPortalEmail(contactEmail.trim());
                      }
                    }}
                  />
                  Create portal account
                </label>
                {createPortalAccount ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="portalEmail">Portal email</Label>
                      <Input
                        id="portalEmail"
                        name="portalEmail"
                        type="email"
                        value={portalEmail}
                        onChange={(e) => setPortalEmail(e.target.value)}
                        placeholder="portal@acme.example"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Portal language</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={portalLocale === "sl" ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => setPortalLocale("sl")}
                        >
                          Slovenščina
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={portalLocale === "en" ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => setPortalLocale("en")}
                        >
                          English
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Onboarding and portal UI for this client.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              defaultValue={client?.phone}
              placeholder="+386 …"
            />
          </Field>
          <Field label="Website" htmlFor="website" className="sm:col-span-2">
            <Input
              id="website"
              name="website"
              defaultValue={client?.website}
              placeholder="acme.example"
            />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea
              id="notes"
              name="notes"
              defaultValue={client?.notes}
              placeholder="Billing notes, contacts, preferences…"
              rows={4}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Billing address"
            htmlFor="billingAddress"
            className="sm:col-span-2"
          >
            <Textarea
              id="billingAddress"
              name="billingAddress"
              defaultValue={client?.billingAddress}
              placeholder="Street, postcode city, country"
              rows={2}
            />
          </Field>
          <Field label="Tax number" htmlFor="taxNumber">
            <Input
              id="taxNumber"
              name="taxNumber"
              defaultValue={client?.taxNumber}
            />
          </Field>
          <Field label="VAT ID" htmlFor="vatId">
            <Input id="vatId" name="vatId" defaultValue={client?.vatId} />
          </Field>
          <Field label="Registration number" htmlFor="registrationNumber">
            <Input
              id="registrationNumber"
              name="registrationNumber"
              defaultValue={client?.registrationNumber}
            />
          </Field>
          <Field label="Payment terms (days)" htmlFor="paymentTermsDays">
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              type="number"
              min={0}
              defaultValue={client?.paymentTermsDays ?? ""}
              placeholder="Override firm default"
            />
          </Field>
        </CardContent>
      </Card>
      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </form>
  );
}
