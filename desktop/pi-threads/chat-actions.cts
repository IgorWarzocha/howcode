import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  createChatGroup,
  moveChatThread,
  renameChatGroup,
  reorderChatGroups,
  setChatGroupCollapsed,
} from "../chat-state-db.cts";
import { getThreadSessionPath } from "../thread-state-db.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

function getChatGroupId(payload: AnyDesktopActionPayload) {
  return typeof payload.chatGroupId === "string" ? payload.chatGroupId : null;
}

function getChatGroupIds(payload: AnyDesktopActionPayload) {
  return Array.isArray(payload.chatGroupIds)
    ? payload.chatGroupIds.filter((id): id is string => typeof id === "string")
    : [];
}

export async function handleChatDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case "chat.group.create": {
      const name = typeof payload.value === "string" ? payload.value : "New group";
      createChatGroup(name);
      return handledAction();
    }
    case "chat.group.rename": {
      const groupId = getChatGroupId(payload);
      const name = typeof payload.value === "string" ? payload.value : "";
      if (groupId) renameChatGroup(groupId, name);
      return handledAction();
    }
    case "chat.group.reorder":
      reorderChatGroups(getChatGroupIds(payload));
      return handledAction();
    case "chat.group.collapse": {
      const groupId = getChatGroupId(payload);
      if (groupId) setChatGroupCollapsed(groupId, payload.value === true);
      return handledAction();
    }
    case "chat.thread.move": {
      const threadId = typeof payload.threadId === "string" ? payload.threadId : null;
      const sessionPath =
        typeof payload.sessionPath === "string"
          ? payload.sessionPath
          : threadId
            ? getThreadSessionPath(threadId)
            : null;
      if (sessionPath) moveChatThread(sessionPath, getChatGroupId(payload));
      return handledAction();
    }
    default:
      return unhandledAction();
  }
}
