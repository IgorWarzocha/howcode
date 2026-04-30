import { randomUUID } from "node:crypto";
import type {
  RuntimeHostMainRequestMap,
  RuntimeHostMainRequestName,
  RuntimeHostMainResponseMap,
  RuntimeHostMainResponseMessage,
} from "./protocol.cts";

const pendingMainRequests = new Map<
  string,
  {
    resolve: (value: RuntimeHostMainResponseMap[RuntimeHostMainRequestName]) => void;
    reject: (error: Error) => void;
  }
>();

export function handleMainResponse(message: RuntimeHostMainResponseMessage) {
  const pending = pendingMainRequests.get(message.id);
  if (!pending) return;
  pendingMainRequests.delete(message.id);
  if (message.ok) {
    pending.resolve(message.result);
    return;
  }
  const error = new Error(message.error);
  if (message.stack) error.stack = message.stack;
  pending.reject(error);
}

export async function invokeMainRequest<TName extends RuntimeHostMainRequestName>(
  name: TName,
  payload: RuntimeHostMainRequestMap[TName],
): Promise<RuntimeHostMainResponseMap[TName]> {
  const id = randomUUID();
  const result = new Promise<RuntimeHostMainResponseMap[TName]>((resolve, reject) => {
    pendingMainRequests.set(id, {
      resolve: (value) => resolve(value as RuntimeHostMainResponseMap[TName]),
      reject,
    });
  });
  process.send?.({ type: "main-request", id, name, payload });
  return await result;
}
