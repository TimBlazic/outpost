"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft } from "lucide-react";

import {
  leadStatuses,
  leadSources,
  leadCategories,
  members as seedMembers,
  type Lead,
  type LeadStatus,
  type Member,
} from "@/lib/data";
import { createLead, updateLead } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

export function LeadForm({
  lead,
  members = seedMembers,
}: {
  lead?: Lead;
  members?: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = Boolean(lead);
  const back = lead ? `/leads/${lead.id}` : "/leads";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const val = (id: string) =>
      (
        f.namedItem(id) as
          | HTMLInputElement
          | HTMLSelectElement
          | null
      )?.value ?? "";

    const input = {
      company: val("company"),
      website: val("website"),
      contact: val("contact"),
      email: val("email"),
      phone: val("phone"),
      country: val("country"),
      category: val("category") as Lead["category"],
      source: val("source") as Lead["source"],
      ownerId: val("owner") || members[0].id,
      status: (val("status") || "New") as LeadStatus,
      value: Number(val("value")) || 0,
      probability: Number(val("probability")) || 0,
      nextFollowUp: val("followup") || null,
      tags: val("tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      description: (
        f.namedItem("description") as HTMLTextAreaElement | null
      )?.value ?? "",
    };

    startTransition(async () => {
      if (lead) {
        await updateLead(lead.id, input);
        router.push(`/leads/${lead.id}`);
      } else {
        await createLead(input);
        router.push("/leads");
      }
      router.refresh();
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
            {editing ? "Edit lead" : "New lead"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Update the lead's details."
              : "Add a company to the pipeline."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={back}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {editing ? "Save changes" : "Save lead"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Company &amp; contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" htmlFor="company" className="sm:col-span-2">
              <Input id="company" defaultValue={lead?.company} placeholder="Acme Inc." required />
            </Field>
            <Field label="Website" htmlFor="website">
              <Input id="website" defaultValue={lead?.website} placeholder="acme.com" />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" defaultValue={lead?.country} placeholder="Slovenia" />
            </Field>
            <Field label="Contact person" htmlFor="contact">
              <Input id="contact" defaultValue={lead?.contact} placeholder="Jane Doe" />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" defaultValue={lead?.email} placeholder="jane@acme.com" />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" defaultValue={lead?.phone} placeholder="+386 …" />
            </Field>
            <Field label="Category" htmlFor="category" className="sm:col-span-2">
              <Select id="category" defaultValue={lead?.category ?? ""}>
                <option value="" disabled>
                  Select…
                </option>
                {leadCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                name="description"
                defaultValue={lead?.description ?? ""}
                placeholder="Research notes, proposed scope, financials…"
                rows={8}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Status" htmlFor="status">
              <Select id="status" defaultValue={lead?.status ?? "New"}>
                {leadStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source" htmlFor="source">
              <Select id="source" defaultValue={lead?.source ?? "Cold email"}>
                {leadSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner" htmlFor="owner">
              <Select id="owner" defaultValue={lead?.ownerId ?? members[0].id}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Est. value (€)" htmlFor="value">
                <Input id="value" type="number" defaultValue={lead?.value} placeholder="5000" min={0} />
              </Field>
              <Field label="Probability (%)" htmlFor="probability">
                <Input
                  id="probability"
                  type="number"
                  defaultValue={lead?.probability}
                  placeholder="25"
                  min={0}
                  max={100}
                />
              </Field>
            </div>
            <Field label="Next follow-up" htmlFor="followup">
              <Input id="followup" type="date" defaultValue={lead?.nextFollowUp ?? ""} />
            </Field>
            <Field label="Tags" htmlFor="tags">
              <Input id="tags" defaultValue={lead?.tags.join(", ")} placeholder="redesign, shopify" />
            </Field>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
