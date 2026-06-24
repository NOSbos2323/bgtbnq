// Telegram admin notifier — sends a message to the configured admin chat.
// Required project secrets:
//   TELEGRAM_BOT_TOKEN       (BotFather token)
//   TELEGRAM_ADMIN_CHAT_ID   (chat id to receive notifications)
//
// Body: { text: string, kind?: "deposit" | "transfer" | "verification" | "info" }
// Auth: requires authenticated user (default verify_jwt = true)

// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    if (!token || !chatId) {
      return new Response(
        JSON.stringify({ ok: false, skipped: true, reason: "telegram secrets not configured" }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const { text, kind = "info" } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const emoji =
      kind === "deposit"      ? "💰"
    : kind === "transfer"     ? "🔁"
    : kind === "verification" ? "🪪"
    :                            "🔔";

    const message = `${emoji} *${kind.toUpperCase()}*\n${text}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const tgJson = await tgRes.json().catch(() => ({}));

    return new Response(JSON.stringify({ ok: tgRes.ok, telegram: tgJson }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
