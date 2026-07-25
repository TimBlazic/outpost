"use server";

import { revalidatePath } from "next/cache";

import type { PortalMessage, PortalMessageReaction } from "@/lib/data";
import { getCurrentProfile, getCurrentUserId } from "@/lib/auth/session";
import {
  getClientById,
  getPortalMessageReactions,
  getPortalMessages,
  getPortalMessagesForProject,
  getProjectById,
  savePortalMessageReactions,
  savePortalMessages,
} from "@/lib/store";
import { assertClientProjectAccess } from "@/lib/client-accounts/access";
import { clientPersonName } from "@/lib/format";
import { assertPortalAccess } from "@/lib/portal/session";
import {
  portalDeleteMessageReaction,
  portalGetMessageReactions,
  portalGetMessages,
  portalGetProjectByToken,
  portalSaveMessage,
  portalSaveMessageReaction,
} from "@/lib/portal/repo";
import { notifyPortalChatChanged } from "@/lib/realtime/notify-chat";

async function resolveClientMessageAuthor(input: {
  client?: { firstName: string; lastName: string; name: string } | null;
  userId?: string | null;
  /** When true, prefer the logged-in profile name (onboarding). */
  useSessionProfile?: boolean;
}) {
  if (input.useSessionProfile && input.userId) {
    try {
      const profile = await getCurrentProfile();
      const name = profile.name?.trim();
      if (name) {
        return { authorId: input.userId, authorName: name };
      }
    } catch {
      /* fall through */
    }
  }
  const authorName = input.client
    ? clientPersonName(input.client)
    : "Client";
  return { authorId: input.userId ?? null, authorName };
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function revalidateChat(
  projectId: string,
  clientId?: string | null,
  token?: string
) {
  revalidatePath("/messages");
  revalidatePath(`/messages/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (token) revalidatePath(`/portal/${token}`);
  void notifyPortalChatChanged(projectId);
}

async function resolveRootParent(
  projectId: string,
  parentId: string | null | undefined,
  loader: (projectId: string) => Promise<PortalMessage[]>
) {
  if (!parentId) return null;
  const messages = await loader(projectId);
  const parent = messages.find((m) => m.id === parentId);
  if (!parent || parent.deletedAt) throw new Error("Parent message not found");
  return parent.parentId ?? parent.id;
}

export async function getStudioPortalMessages(projectId: string) {
  return getPortalMessagesForProject(projectId);
}

export async function postStudioPortalMessage(
  projectId: string,
  body: string,
  parentId?: string | null
) {
  const text = body.trim();
  if (!text) throw new Error("Message is empty");

  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const rootParent = await resolveRootParent(
    projectId,
    parentId,
    getPortalMessagesForProject
  );

  const profile = await getCurrentProfile();
  const message: PortalMessage = {
    id: uid("pm"),
    projectId,
    parentId: rootParent,
    body: text,
    authorKind: "studio",
    authorId: profile.id,
    authorName: profile.name,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    attachmentId: null,
  };

  const all = await getPortalMessages();
  await savePortalMessages([...all, message]);
  revalidateChat(projectId, project.clientId);
  return message.id;
}

export async function postClientPortalMessage(
  token: string,
  body: string,
  parentId?: string | null
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");

  const text = body.trim();
  if (!text) throw new Error("Message is empty");

  const rootParent = await resolveRootParent(
    project.id,
    parentId,
    portalGetMessages
  );

  const client = project.clientId
    ? await getClientById(project.clientId)
    : null;
  const { authorId, authorName } = await resolveClientMessageAuthor({
    client,
    userId: client?.authUserId ?? null,
    useSessionProfile: false,
  });

  const message: PortalMessage = {
    id: uid("pm"),
    projectId: project.id,
    parentId: rootParent,
    body: text,
    authorKind: "client",
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    attachmentId: null,
  };

  await portalSaveMessage(message);
  revalidateChat(project.id, project.clientId, token);
  return message.id;
}

export async function editStudioPortalMessage(messageId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Message is empty");
  const userId = await getCurrentUserId();
  const all = await getPortalMessages();
  const existing = all.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.deletedAt) throw new Error("Message was unsent");
  if (existing.authorKind !== "studio" || existing.authorId !== userId) {
    throw new Error("You can only edit your own messages");
  }
  const next = {
    ...existing,
    body: text,
    editedAt: new Date().toISOString(),
  };
  await savePortalMessages(all.map((m) => (m.id === messageId ? next : m)));
  const project = await getProjectById(existing.projectId);
  revalidateChat(existing.projectId, project?.clientId);
}

export async function editClientPortalMessage(
  token: string,
  messageId: string,
  body: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  const text = body.trim();
  if (!text) throw new Error("Message is empty");

  const messages = await portalGetMessages(project.id);
  const existing = messages.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.deletedAt) throw new Error("Message was unsent");
  if (existing.authorKind !== "client") {
    throw new Error("You can only edit your own messages");
  }

  await portalSaveMessage({
    ...existing,
    body: text,
    editedAt: new Date().toISOString(),
  });
  revalidateChat(project.id, project.clientId, token);
}

export async function unsendStudioPortalMessage(messageId: string) {
  const userId = await getCurrentUserId();
  const all = await getPortalMessages();
  const existing = all.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.authorKind !== "studio" || existing.authorId !== userId) {
    throw new Error("You can only unsend your own messages");
  }
  const next = {
    ...existing,
    deletedAt: existing.deletedAt || new Date().toISOString(),
  };
  await savePortalMessages(all.map((m) => (m.id === messageId ? next : m)));
  const project = await getProjectById(existing.projectId);
  revalidateChat(existing.projectId, project?.clientId);
}

export async function unsendClientPortalMessage(
  token: string,
  messageId: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  const messages = await portalGetMessages(project.id);
  const existing = messages.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.authorKind !== "client") {
    throw new Error("You can only unsend your own messages");
  }
  await portalSaveMessage({
    ...existing,
    deletedAt: existing.deletedAt || new Date().toISOString(),
  });
  revalidateChat(project.id, project.clientId, token);
}

export async function toggleStudioPortalMessageReaction(
  messageId: string,
  emoji: string
) {
  const profile = await getCurrentProfile();
  const all = await getPortalMessages();
  const message = all.find((m) => m.id === messageId);
  if (!message || message.deletedAt) throw new Error("Message not found");

  const reactions = await getPortalMessageReactions();
  const existing = reactions.find(
    (r) =>
      r.messageId === messageId &&
      r.emoji === emoji &&
      r.authorKind === "studio" &&
      r.authorName === profile.name
  );

  if (existing) {
    await savePortalMessageReactions(
      reactions.filter((r) => r.id !== existing.id)
    );
  } else {
    const reaction: PortalMessageReaction = {
      id: uid("pmr"),
      messageId,
      emoji,
      authorKind: "studio",
      authorName: profile.name,
      createdAt: new Date().toISOString(),
    };
    await savePortalMessageReactions([...reactions, reaction]);
  }

  const project = await getProjectById(message.projectId);
  revalidateChat(message.projectId, project?.clientId);
}

export async function toggleClientPortalMessageReaction(
  token: string,
  messageId: string,
  emoji: string
) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  const messages = await portalGetMessages(project.id);
  const message = messages.find((m) => m.id === messageId);
  if (!message || message.deletedAt) throw new Error("Message not found");

  const client = project.clientId
    ? await getClientById(project.clientId)
    : null;
  const { authorName } = await resolveClientMessageAuthor({
    client,
    userId: client?.authUserId ?? null,
    useSessionProfile: false,
  });
  const reactions = await portalGetMessageReactions([messageId]);
  // One client voice per project — match any prior client reaction on this emoji.
  const existing = reactions.find(
    (r) =>
      r.messageId === messageId &&
      r.emoji === emoji &&
      r.authorKind === "client"
  );

  if (existing) {
    await portalDeleteMessageReaction(existing.id);
  } else {
    await portalSaveMessageReaction({
      id: uid("pmr"),
      messageId,
      emoji,
      authorKind: "client",
      authorName,
      createdAt: new Date().toISOString(),
    });
  }
  revalidateChat(project.id, project.clientId, token);
}

export async function listClientPortalMessages(token: string) {
  await assertPortalAccess(token);
  const project = await portalGetProjectByToken(token);
  if (!project) throw new Error("Portal not found");
  return portalGetMessages(project.id);
}

// ---- Session-based client message actions ---------------------------------

export async function sessionPostClientPortalMessage(
  projectId: string,
  body: string,
  parentId?: string | null
) {
  const { client, project, userId } =
    await assertClientProjectAccess(projectId);
  const text = body.trim();
  if (!text) throw new Error("Message is empty");

  const rootParent = await resolveRootParent(
    project.id,
    parentId,
    portalGetMessages
  );

  const { authorId, authorName } = await resolveClientMessageAuthor({
    client,
    userId,
    useSessionProfile: true,
  });

  const message: PortalMessage = {
    id: uid("pm"),
    projectId: project.id,
    parentId: rootParent,
    body: text,
    authorKind: "client",
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    attachmentId: null,
  };

  await portalSaveMessage(message);
  revalidateChat(project.id, project.clientId);
  return message.id;
}

export async function sessionEditClientPortalMessage(
  projectId: string,
  messageId: string,
  body: string
) {
  const { project } = await assertClientProjectAccess(projectId);
  const text = body.trim();
  if (!text) throw new Error("Message is empty");

  const messages = await portalGetMessages(project.id);
  const existing = messages.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.deletedAt) throw new Error("Message was unsent");
  if (existing.authorKind !== "client") {
    throw new Error("You can only edit your own messages");
  }

  await portalSaveMessage({
    ...existing,
    body: text,
    editedAt: new Date().toISOString(),
  });
  revalidateChat(project.id, project.clientId);
}

export async function sessionUnsendClientPortalMessage(
  projectId: string,
  messageId: string
) {
  const { project } = await assertClientProjectAccess(projectId);
  const messages = await portalGetMessages(project.id);
  const existing = messages.find((m) => m.id === messageId);
  if (!existing) throw new Error("Message not found");
  if (existing.authorKind !== "client") {
    throw new Error("You can only unsend your own messages");
  }
  await portalSaveMessage({
    ...existing,
    deletedAt: existing.deletedAt || new Date().toISOString(),
  });
  revalidateChat(project.id, project.clientId);
}

export async function sessionToggleClientPortalMessageReaction(
  projectId: string,
  messageId: string,
  emoji: string
) {
  const { client, project, userId } =
    await assertClientProjectAccess(projectId);
  const messages = await portalGetMessages(project.id);
  const message = messages.find((m) => m.id === messageId);
  if (!message || message.deletedAt) throw new Error("Message not found");

  const { authorName } = await resolveClientMessageAuthor({
    client,
    userId,
    useSessionProfile: true,
  });
  const reactions = await portalGetMessageReactions([messageId]);
  const existing = reactions.find(
    (r) =>
      r.messageId === messageId &&
      r.emoji === emoji &&
      r.authorKind === "client"
  );

  if (existing) {
    await portalDeleteMessageReaction(existing.id);
  } else {
    await portalSaveMessageReaction({
      id: uid("pmr"),
      messageId,
      emoji,
      authorKind: "client",
      authorName,
      createdAt: new Date().toISOString(),
    });
  }
  revalidateChat(project.id, project.clientId);
}
