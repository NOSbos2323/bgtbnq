// Telegram admin notifier.
//   kind = "deposit_new"    → single button "🏦 تعيين RIP" (assign_rib:deposit:<id>)
//   kind = "deposit" | "transfer" | "verification" with id → Accept / Reject buttons
//   otherwise plain informational message.
//
// Required project secrets:
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_ADMIN_CHAT_ID

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
      return new Response(JSON.stringify({ ok: false, skipped: true }), {
        status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { text, kind = "info", id } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "missing text" }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const emoji =
      kind === "deposit_new"    ? "🆕💰"
    : kind === "deposit"        ? "💰"
    : kind === "transfer"       ? "🔁"
    : kind === "verification"   ? "🪪"
    :                              "🔔";

    const message = `${emoji} *${String(kind).toUpperCase()}*\n${text}`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    if (id && kind === "deposit_new") {
      body.reply_markup = {
        inline_keyboard: [[
          { text: "🏦 تعيين RIP", callback_data: `assign_rib:deposit:${id}` },
          { text: "❌ رفض", callback_data: `reject:deposit:${id}` },
        ]],
      };
    } else if (id && (kind === "deposit" || kind === "transfer" || kind === "verification")) {
      body.reply_markup = {
        inline_keyboard: [[
          { text: "✅ قبول", callback_data: `approve:${kind}:${id}` },
          { text: "❌ رفض",  callback_data: `reject:${kind}:${id}` },
        ]],
      };
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const tgJson = await tgRes.json().catch(() => ({}));

    return new Response(JSON.stringify({ ok: tgRes.ok, telegram: tgJson }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
