/** Channel name shared by client subscriptions + server REST broadcast. */
export function portalChatChannelName(projectId: string) {
  return `portal-chat-${projectId}`;
}
