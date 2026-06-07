# Social Login Setup — Google & Microsoft

## Voraussetzungen
- Appwrite Console: https://cloud.appwrite.io
- Google Cloud Console: https://console.cloud.google.com
- Microsoft Azure Portal: https://portal.azure.com

---

## 1. Google OAuth App anlegen

1. Gehe zu **Google Cloud Console → APIs & Services → Credentials**
2. Klicke **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Sustainista HR`
5. Authorized redirect URIs:
   ```
   https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/<DEINE_PROJECT_ID>
   ```
   (Ersetze `<DEINE_PROJECT_ID>` mit `6a2567ad0021c84890d1`)
6. Notiere **Client ID** und **Client Secret**

---

## 2. Microsoft OAuth App anlegen

1. Gehe zu **Azure Portal → App registrations → + New registration**
2. Name: `Sustainista HR`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Redirect URI: Web →
   ```
   https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/microsoft/<DEINE_PROJECT_ID>
   ```
5. Nach der Erstellung: **Certificates & secrets → + New client secret**
6. Notiere **Application (client) ID** und den **Secret Value**

---

## 3. Provider in Appwrite aktivieren

1. Öffne **Appwrite Console → dein Projekt → Auth → Settings → OAuth2 Providers**
2. Klicke auf **Google**:
   - App ID: `<Google Client ID>`
   - App Secret: `<Google Client Secret>`
   - Aktivieren (Toggle)
3. Klicke auf **Microsoft**:
   - App ID: `<Azure Application ID>`
   - App Secret: `<Azure Client Secret Value>`
   - Aktivieren (Toggle)

---

## 4. Callback-URL in Vercel / Lokal

Die App leitet nach dem OAuth-Login immer zu `/auth/callback` weiter.

Lokale Entwicklung:
- Success: `http://localhost:3000/auth/callback`
- Failure: `http://localhost:3000/auth/callback?error=<provider>`

Produktion (Vercel):
- Success: `https://sustainista-hr.vercel.app/auth/callback`
- Failure: `https://sustainista-hr.vercel.app/auth/callback?error=<provider>`

---

## 5. Verhalten nach OAuth-Login

| Situation | Weiterleitung |
|---|---|
| Neuer User (kein Profil) | → `/onboarding` (Profil wird als `pending` angelegt) |
| Pending, Schritt noch offen | → `/onboarding` |
| Pending, Daten eingereicht | → `/pending` (Wartezimmer) |
| Active employee | → `/dashboard` |
| Admin-User | → `/admin` |
| Rejected | → `/pending` (mit Begründung) |
