"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft } from "lucide-react";

import type { Client } from "@/lib/data";
import { createClient, updateClient } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const back = client ? `/clients/${client.id}` : "/clients";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const val = (id: string) =>
      (f.namedItem(id) as HTMLInputElement | HTMLTextAreaElement | null)
        ?.value ?? "";

    const input = {
      name: val("name").trim(),
      email: val("email").trim(),
      phone: val("phone").trim(),
      company: val("company").trim() || val("name").trim(),
      website: val("website").trim(),
      country: val("country").trim(),
      notes: val("notes"),
      leadId: client?.leadId,
    };

    startTransition(async () => {
      if (client) {
        await updateClient(client.id, input);
        router.push(`/clients/${client.id}`);
      } else {
        const id = await createClient(input);
        router.push(`/clients/${id}`);
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
              defaultValue={client?.email}
              placeholder="hello@acme.example"
            />
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
    </form>
  );
}
