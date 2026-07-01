import { supabase } from "@/integrations/supabase/client";

type Kind = "deposit" | "deposit_new" | "transfer" | "verification" | "info";

/**
 * Fire-and-forget Telegram notification to the admin chat.
 * When `id` is provided for an actionable kind, the message includes
 * inline Accept / Reject buttons handled by the telegram-webhook function.
 */
export async function notifyAdmin(kind: Kind, text: string, id?: string) {
  try {
    await supabase.functions.invoke("telegram-notify", { body: { kind, text, id } });
  } catch {
    /* silent */
  }
}
