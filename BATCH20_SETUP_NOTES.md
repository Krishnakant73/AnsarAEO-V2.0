# Batch 20 — Credential Encryption (Closing the Critical Gap from Batch 19)

## 1. No new npm packages — uses Node's built-in `crypto` module.

## 2. Generate your encryption key
Run this once, locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
This prints a 64-character hex string (32 bytes). Add it to `.env.local`:
```
ENCRYPTION_KEY=paste-the-64-character-hex-string-here
```

**Treat this key with the same seriousness as `SUPABASE_SERVICE_ROLE_KEY`.** Anyone with
this key can decrypt every customer's stored GA4/Shopify credentials. Never commit it,
never log it, store it in Vercel's encrypted environment variables for production (not
in a file that gets deployed).

## 3. Files in this batch

| File | What changed |
|---|---|
| `src/lib/crypto.ts` | **New** — `encryptCredentials()` / `decryptCredentials()` using AES-256-GCM |
| `src/app/api/settings/analytics/route.ts` | Updated — encrypts before storing |
| `src/app/api/analytics/revenue/route.ts` | Updated — decrypts right before use, never exposes the decrypted value to the client |

## 4. Important — this does NOT retroactively encrypt existing data
If you already connected a GA4 or Shopify integration while testing Batch 19 (before this
fix), that row's `credentials` column still holds the OLD plaintext format. The new code
expects the new encrypted format (`{ data: "iv:tag:ciphertext" }`) and will fail to parse
the old rows.

**Simplest fix — since this is still pre-launch/testing data:** just delete the old rows
and reconnect:
```sql
delete from integrations;
```
Then go to `/dashboard/settings/analytics` and reconnect GA4/Shopify — they'll be stored
encrypted this time.

(If this were a live product with real customer connections already made, the correct
approach would be a one-time migration script that reads each old plaintext row, encrypts
it with the new function, and updates it in place — not a blind delete. Flagging this
distinction now so future-you doesn't blindly delete real customer data during a similar
migration later.)

## 5. Test it
```bash
npm run dev
```
1. Reconnect GA4/Shopify at `/dashboard/settings/analytics`
2. Check the `integrations` table directly in Supabase Table Editor — the `credentials`
   column should show something like `{"data": "a1b2c3...:d4e5f6...:789abc..."}`, not
   readable JSON/tokens
3. Go to `/dashboard/revenue` — it should still work exactly as before, decrypting
   transparently server-side

## 6. Apply this pattern going forward
Any time you store a new type of third-party credential in the database (a future
WordPress integration's application password, a future OAuth refresh token, etc.), run it
through `encryptCredentials()`/`decryptCredentials()` the same way — don't let plaintext
secrets creep back into new tables later.
