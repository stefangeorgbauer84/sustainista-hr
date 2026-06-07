# Sustainista HR — Setup Guide

## 1. Appwrite Cloud Projekt anlegen

1. Gehe auf https://cloud.appwrite.io
2. Neues Projekt anlegen: Name = `sustainista-hr`
3. Web-Platform hinzufügen: Hostname = `localhost` (lokal) und später deine Vercel-URL

## 2. Appwrite Datenbank anlegen

Im Appwrite-Dashboard:

### Datenbank erstellen
- Database ID: `sustainista-hr`

### Collections erstellen

**employees**
| Attribut | Typ | Required |
|---|---|---|
| userId | string | yes |
| firstName | string | yes |
| lastName | string | yes |
| email | string | yes |
| role | enum: admin,employee | yes |
| department | string | yes |
| position | string | yes |
| startDate | string | yes |
| vacationDaysTotal | integer (default: 25) | yes |
| vacationDaysUsed | integer (default: 0) | yes |
| bankAccount | string | no |
| phone | string | no |
| address | string | no |

**time_entries**
| Attribut | Typ | Required |
|---|---|---|
| employeeId | string | yes |
| date | string | yes |
| startTime | string | yes |
| endTime | string | no |
| breakMinutes | integer (default: 0) | yes |
| note | string | no |
| status | enum: running,completed,approved,rejected | yes |
| approvedBy | string | no |

**leave_requests**
| Attribut | Typ | Required |
|---|---|---|
| employeeId | string | yes |
| employeeName | string | yes |
| type | enum: vacation,sick,unpaid,special | yes |
| startDate | string | yes |
| endDate | string | yes |
| days | integer | yes |
| reason | string | no |
| status | enum: pending,approved,rejected | yes |
| approvedBy | string | no |
| approvedAt | string | no |

**documents**
| Attribut | Typ | Required |
|---|---|---|
| employeeId | string | yes |
| type | enum: payslip,contract,other | yes |
| title | string | yes |
| fileId | string | yes |
| month | string | no |
| uploadedBy | string | yes |

### Indexes (für Queries)
- employees: userId (key)
- time_entries: employeeId (key), status (key), date (key)
- leave_requests: employeeId (key), status (key), startDate (key)
- documents: employeeId (key)

### Storage Bucket
- Bucket ID: `documents`
- Max file size: 10 MB
- Erlaubte MIME: application/pdf, image/*

## 3. Umgebungsvariablen setzen

Erstelle eine `.env.local` Datei:

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=DEINE_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID=sustainista-hr
```

## 4. Admin-User anlegen

1. Appwrite Dashboard → Auth → Users → Create User
2. E-Mail + Passwort eintragen
3. Nach dem Anlegen: Users → den User anklicken → Labels → `admin` hinzufügen
4. Im `employees`-Collection einen Eintrag für diesen User erstellen

## 5. Lokal starten

```bash
npm run dev
```

App läuft auf http://localhost:3000
