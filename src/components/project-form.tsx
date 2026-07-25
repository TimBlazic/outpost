"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";

import {
  projectTypes,
  projectStatuses,
  leadSources,
  deliveryPhaseOptions,
  members as seedMembers,
  type Project,
  type Lead,
  isArchived,
  type Client,
  type ProjectType,
  type ProjectStatus,
  type Member,
} from "@/lib/data";
import { createProject, updateProject } from "@/lib/actions";
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

export function ProjectForm({
  project,
  leads,
  clients,
  defaultLeadId,
  defaultClientId,
  members = seedMembers,
}: {
  project?: Project;
  leads: Lead[];
  clients: Client[];
  defaultLeadId?: string;
  defaultClientId?: string;
  members?: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = Boolean(project);
  const back = project ? `/projects/${project.id}` : "/projects";
  const seedLead =
    !project && defaultLeadId
      ? leads.find((l) => l.id === defaultLeadId)
      : undefined;

  const initialClientId =
    project?.clientId ??
    defaultClientId ??
    (seedLead
      ? clients.find(
          (c) =>
            c.leadId === seedLead.id ||
            c.name.toLowerCase() === seedLead.company.toLowerCase()
        )?.id
      : undefined) ??
    "";

  const [clientId, setClientId] = useState(initialClientId);
  const [newClientName, setNewClientName] = useState(
    !initialClientId
      ? (project?.client ?? seedLead?.company ?? "")
      : ""
  );

  const selectableClients = clients.filter(
    (c) => !isArchived(c) || c.id === project?.clientId
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const val = (id: string) =>
      (
        f.namedItem(id) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | null
      )?.value ?? "";

    const selected = clients.find((c) => c.id === clientId);
    const clientName =
      selected?.name ?? (newClientName.trim() || val("clientName").trim());

    const input = {
      name: val("name"),
      client: clientName,
      clientId: selected?.id ?? null,
      description: val("description"),
      phase: val("phase"),
      type: val("type") as ProjectType,
      value: Number(val("value")) || 0,
      status: val("status") as ProjectStatus,
      start: val("start"),
      estimatedEnd: val("estimatedEnd"),
      actualEnd: val("actualEnd") || null,
      ownerId: val("owner") || members[0].id,
      cost: Number(val("cost")) || 0,
      source: val("source") as Lead["source"],
      leadId: val("lead") || undefined,
    };

    startTransition(async () => {
      if (project) {
        await updateProject(project.id, input);
        router.push(`/projects/${project.id}`);
      } else {
        const id = await createProject(input);
        router.push(`/projects/${id}`);
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
            {editing ? "Edit project" : "New project"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Update project details and client link."
              : "Create a project and attach it to a client."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={back}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {editing ? "Save changes" : "Create project"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Project</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" htmlFor="name" className="sm:col-span-2">
              <Input
                id="name"
                name="name"
                defaultValue={
                  project?.name ??
                  (seedLead ? `${seedLead.company} — Project` : undefined)
                }
                placeholder="Acme — Website redesign"
                required
              />
            </Field>
            <Field label="Client" htmlFor="clientId" className="sm:col-span-2">
              <Select
                id="clientId"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  if (e.target.value) setNewClientName("");
                }}
              >
                <option value="">New client…</option>
                {selectableClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ""}
                    {isArchived(c) ? " (archived)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {!clientId && (
              <Field
                label="New client name"
                htmlFor="clientName"
                className="sm:col-span-2"
              >
                <Input
                  id="clientName"
                  name="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Acme Inc."
                  required
                />
              </Field>
            )}
            <Field
              label="Description"
              htmlFor="description"
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                name="description"
                defaultValue={project?.description}
                placeholder="Scope, goals, delivery notes…"
                rows={4}
              />
            </Field>
            <Field label="Phase" htmlFor="phase">
              <Select
                id="phase"
                name="phase"
                defaultValue={project?.phase ?? deliveryPhaseOptions[0]}
              >
                {deliveryPhaseOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="type">
              <Select
                id="type"
                name="type"
                defaultValue={project?.type ?? projectTypes[0]}
              >
                {projectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Value (€)" htmlFor="value">
              <Input
                id="value"
                name="value"
                type="number"
                defaultValue={project?.value ?? seedLead?.value}
                placeholder="8000"
                min={0}
              />
            </Field>
            <Field label="Cost (€)" htmlFor="cost">
              <Input
                id="cost"
                name="cost"
                type="number"
                defaultValue={project?.cost}
                placeholder="500"
                min={0}
              />
            </Field>
            <Field label="Source" htmlFor="source">
              <Select
                id="source"
                name="source"
                defaultValue={
                  project?.source ?? seedLead?.source ?? leadSources[0]
                }
              >
                {leadSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Originating lead" htmlFor="lead">
              <Select
                id="lead"
                name="lead"
                defaultValue={project?.leadId ?? defaultLeadId ?? ""}
              >
                <option value="">None</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Status &amp; timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue={project?.status ?? "Discovery"}
              >
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner" htmlFor="owner">
              <Select
                id="owner"
                name="owner"
                defaultValue={
                  project?.ownerId ?? seedLead?.ownerId ?? members[0].id
                }
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start" htmlFor="start">
              <Input
                id="start"
                name="start"
                type="date"
                required
                defaultValue={
                  project?.start ?? new Date().toISOString().slice(0, 10)
                }
              />
            </Field>
            <Field label="Estimated end" htmlFor="estimatedEnd">
              <Input
                id="estimatedEnd"
                name="estimatedEnd"
                type="date"
                required
                defaultValue={
                  project?.estimatedEnd ??
                  new Date().toISOString().slice(0, 10)
                }
              />
            </Field>
            <Field label="Actual end" htmlFor="actualEnd">
              <Input
                id="actualEnd"
                name="actualEnd"
                type="date"
                defaultValue={project?.actualEnd ?? ""}
              />
            </Field>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
