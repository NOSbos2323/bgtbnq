// Telegram webhook — receives callback_query events from Accept / Reject buttons
// posted by telegram-notify, then drives the admin approve/reject RPCs via the
// service-role client and acknowledges the user inside Telegram.
//
// Required project secrets:
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_ADMIN_CHAT_ID
//   TELEGRAM_WEBHOOK_SECRET   (shared secret echoed back by Telegram in the
//                              X-Telegram-Bot-Api-Secret-Token header)
//   SUPABASE_URL              (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided)

// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TG = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

async function tg(token: string, method: string, payload: unknown) {
  try {
    await fetch(TG(token, method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { /* silent */ }
}

Deno.serve(async (req) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const adminChatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

  if (!token || !adminChatId) {
    return new Response("telegram not configured", { status: 200 });
  }

  // One-shot self-registration: GET /telegram-webhook?setup=1 registers this
  // URL as the bot's webhook (uses the request's own origin) and configures
  // the shared secret_token Telegram echoes back on every callback.
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("setup") === "1") {
      const webhookUrl = `${url.origin}${url.pathname}`;
      const res = await fetch(TG(token, "setWebhook"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret ?? undefined,
          allowed_updates: ["callback_query"],
          drop_pending_updates: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ webhookUrl, telegram: json }, null, 2), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    return new Response("ok");
  }

  // Verify Telegram secret token header.
  if (webhookSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== webhookSecret) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  let update: any = null;
  try { update = await req.json(); } catch { return new Response("ok"); }

  const cb = update?.callback_query;
  if (!cb) return new Response("ok"); // ignore non-callback updates

  const fromChat = String(cb.message?.chat?.id ?? "");
  if (fromChat !== String(adminChatId)) {
    await tg(token, "answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Unauthorized chat",
      show_alert: true,
    });
    return new Response("ok");
  }

  const data: string = cb.data ?? "";
  const [action, kind, id] = data.split(":");
  if (!action || !kind || !id) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Bad payload" });
    return new Response("ok");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase.rpc("telegram_admin_action", {
    _kind: kind,
    _id: id,
    _action: action,
    _note: action === "reject" ? "Rejected via Telegram" : null,
  });

  const ok = !error;
  const verdict = action === "approve" ? "✅ تم القبول" : "❌ تم الرفض";
  const status = ok ? verdict : `⚠️ فشل: ${error?.message ?? "unknown error"}`;

  await tg(token, "answerCallbackQuery", {
    callback_query_id: cb.id,
    text: ok ? verdict : "فشلت العملية",
    show_alert: !ok,
  });

  // Append the verdict to the original message and strip the buttons.
  const originalText: string = cb.message?.text ?? "";
  await tg(token, "editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    text: `${originalText}\n\n— ${status}`,
    disable_web_page_preview: true,
  });

  return new Response("ok");
});
