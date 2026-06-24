import { supabase } from "@/integrations/supabase/client";

type Kind = "deposit" | "transfer" | "verification" | "info";

/** Fire-and-forget Telegram notification to the admin chat. Never throws. */
export async function notifyAdmin(kind: Kind, text: string) {
  try {
    await supabase.functions.invoke("telegram-notify", { body: { kind, text } });
  } catch {
    /* silent */
  }
}
