# Turn the AI from demo → real (10 minutes, your key stays hidden)

The platform already calls Claude through a **secure proxy** on your Supabase.
Your API key is **never** in the app and I never see it — you paste it once, into
a Supabase secret. Do these 3 steps.

---

## Step 1 — Deploy the `ai` function on Supabase

1. Open **https://supabase.com/dashboard** → your project (`tngmgmwuqakoaefkhsys`).
2. Left sidebar → **Edge Functions**.
3. Click **Deploy a new function** (or **Create a function**) → name it **exactly**:

   ```
   ai
   ```

4. In the code editor, **delete the sample** and paste the entire contents of:

   `supabase/functions/ai/index.ts`  (in this project)

5. **IMPORTANT — turn OFF "Verify JWT"** for this function (there's a toggle on
   the deploy screen, or under the function's **Details / Settings**). The app
   signs in to the proxy with your public key, not a JWT, so this must be off.
6. Click **Deploy**.

The function is now live at:
`https://tngmgmwuqakoaefkhsys.supabase.co/functions/v1/ai`

---

## Step 2 — Paste your Claude key as a secret (only place it ever lives)

1. Still in **Edge Functions** → **Secrets** (also called **Manage secrets** /
   Project Settings → Edge Functions).
2. Add a new secret:

   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (your key) |

3. Save.

> That key stays on Supabase's servers. It is **not** in the website code, not in
> this chat, and not on anyone's device.

---

## Step 3 — Confirm it's live

1. Open the ERP → **Admin console** → **AI engine** card → **Test AI connection**.
   - 🟢 **LIVE — real Claude AI** = done.
   - 🟡 **Demo mode** = the key secret isn't set yet (recheck Step 2).
2. Try it for real:
   - **Daily Quiz → Study & Ask AI**: ask *"Explain DSCR for a Zimbabwe solar IPP."*
   - **Chatbot** (bottom-right): *"What needs attention across the group?"*
   - **AI → Document Studio**: pick *Investment Memo*, add a one-line brief, **Draft**.

If a call ever fails, the feature silently falls back to the built-in demo answer —
nothing breaks.

---

## What it costs (kept deliberately low)

- Chat, Ask-AI, quiz tutor → **Claude Haiku 5.5** — ~$0.10 per 1M input / $0.50 per 1M output.
- Document Studio drafting → **Claude Sonnet 5.5** — ~$2 / $10 per 1M.
- `max_tokens` is capped in the function, and only these two cheap models are
  allowed, so a bad call can't drain the balance. Your **Anthropic spend cap** is
  the final backstop. Typical demo usage is **cents per day**.

---

## Nothing else to redeploy for the AI

The app talks to the function at a fixed URL, so once the function + secret are
set, every AI feature is live. (You only redeploy the website when the app code
itself changes.)
