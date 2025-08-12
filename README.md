# Baby in Need - Geschenke-App

Eine Next.js-App für werdende Eltern, um Geschenke zu verwalten und zu reservieren.

## 🚀 Features

- ✅ Geschenke hinzufügen und verwalten
- ✅ Einfache Reservierung ohne Login
- ✅ **Automatische E-Mail-Bestätigungen für Schenkende**
- ✅ Benachrichtigungen für werdende Eltern
- ✅ Responsive Design
- ✅ Echtzeit-Updates

## 📧 E-Mail-Sicherheit & Bestätigungen

### Kritische Sicherheitsmaßnahmen

Die App implementiert mehrere Sicherheitsebenen, um sicherzustellen, dass **jeder Schenkende definitiv eine Bestätigungsmail erhält**:

1. **Rollback bei E-Mail-Fehlern**: Wenn die Bestätigungsmail fehlschlägt, wird die Reservierung automatisch rückgängig gemacht
2. **E-Mail-Validierung**: E-Mail-Adressen werden vor dem Versand validiert
3. **Fehlerbehandlung**: Umfassende Fehlerbehandlung und Logging
4. **Admin-Überwachung**: Admins können den E-Mail-Service testen und überwachen
5. **Professionelle Templates**: HTML-E-Mails mit Fallback auf Text-Version

### E-Mail-Flow

```
Schenkender reserviert → E-Mail wird gesendet → Reservierung bestätigt
                    ↓
                E-Mail fehlschlägt → Reservierung wird rückgängig gemacht
```

## 🔧 Installation

1. **Repository klonen**
   ```bash
   git clone [repository-url]
   cd baby-in-need-4
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env.local
   ```

## ⚙️ Umgebungsvariablen

### Erforderlich

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# E-Mail (Resend)
RESEND_API_KEY=re_3MHFTcbs_BFPEx4G55qeJvQ6Zc8qJDGFz
ADMIN_CODE=your_admin_secret_code
```

### Optional

```bash
# E-Mail-Einstellungen
NOTIFY_FROM=Baby in Need <noreply@ailiteracy.ch>
RECIPIENTS_TO=gianpeterochsner@gmail.com

# Standard: "Baby in Need <noreply@ailiteracy.ch>"
# Standard: gianpeterochsner@gmail.com
```

## 📧 E-Mail-Service (Resend)

Die App verwendet [Resend](https://resend.com) für zuverlässige E-Mail-Zustellung:

1. **Konto erstellen** bei [resend.com](https://resend.com)
2. **API-Key generieren**
3. **Domain verifizieren** (optional, aber empfohlen)
4. **API-Key in `.env.local` eintragen**

### E-Mail-Templates

- **Schenkende**: Professionelle Bestätigungsmail mit HTML-Design
- **Eltern**: Benachrichtigung über neue Reservierungen
- **Fallback**: Text-Version für alle E-Mail-Clients

## 🛡️ Admin-Funktionen

### Admin aktivieren
1. Admin-Button klicken
2. Admin-Code eingeben (aus Umgebungsvariablen)
3. Vollzugriff auf alle Funktionen

### E-Mail-Überwachung
- **Status prüfen**: E-Mail-Service testen
- **Test-E-Mail senden**: Bestätigungsmail testen
- **Einstellungen verwalten**: Eltern-E-Mails konfigurieren

## 🚀 Deployment

### Vercel (Empfohlen)
```bash
npm run build
vercel --prod
```

### Andere Plattformen
```bash
npm run build
npm start
```

## 📊 Datenbank-Schema

```sql
-- Items-Tabelle
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item TEXT NOT NULL,
  url TEXT,
  price TEXT,
  size TEXT,
  notes TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Konfiguration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

## 🔍 Troubleshooting

### E-Mails werden nicht gesendet
1. **Resend API-Key prüfen** in Admin-UI
2. **Domain-Verifizierung** bei Resend
3. **Logs prüfen** in der Konsole
4. **Test-E-Mail senden** über Admin-UI

### Reservierung funktioniert nicht
1. **E-Mail-Validierung** prüfen
2. **Supabase-Verbindung** testen
3. **Admin-Code** korrekt eingeben

## 📝 Lizenz

MIT License - siehe LICENSE-Datei

## 🤝 Beitragen

1. Fork erstellen
2. Feature-Branch erstellen
3. Änderungen committen
4. Pull Request erstellen

---

**Wichtig**: Diese App stellt sicher, dass jeder Schenkende eine Bestätigungsmail erhält. Bei E-Mail-Fehlern werden Reservierungen automatisch rückgängig gemacht.
