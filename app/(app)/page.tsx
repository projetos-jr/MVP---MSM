import { ChatApp } from "@/components/chat/chat-app";
import { getUserName } from "@/lib/session";

export default async function ChatPage() {
  const userName = await getUserName();
  return <ChatApp userName={userName} />;
}
