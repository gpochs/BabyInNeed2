"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import StrollerGame from "./components/StrollerGame";

type Item = {
  id: string; item: string; url?: string; price?: string; size?: string; notes?: string;
  claimed_at?: string | null; created_at?: string;
};
const ADMIN_FLAG = "bin_admin_code";

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [parentEmails, setParentEmails] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ valid: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testItem, setTestItem] = useState("Test-Geschenk");

  const open = useMemo(() => items.filter(i => !i.claimed_at), [items]);
  const reserved = useMemo(() => items.filter(i => !!i.claimed_at), [items]);

  useEffect(() => {
    let sub: ReturnType<typeof supabaseClient.channel> | null = null;
    (async () => {
      setLoading(true);
      const { data } = await supabaseClient.from("items").select("*").order("created_at", { ascending: false });
      setItems((data ?? []) as Item[]); setLoading(false);

      const conf = await supabaseClient.from("config").select("value").eq("key", "recipients").maybeSingle();
      if (conf.data?.value?.emails) setParentEmails(conf.data.value.emails);

      sub = supabaseClient
        .channel("items-stream")
        .on("postgres_changes", { event: "*", schema: "public", table: "items" }, async () => {
          const { data } = await supabaseClient.from("items").select("*").order("created_at", { ascending: false });
          setItems((data ?? []) as Item[]);
        }).subscribe();
    })();
    const saved = localStorage.getItem(ADMIN_FLAG); if (saved) setAdminCode(saved);
    return () => { if (sub) supabaseClient.removeChannel(sub); };
  }, []);

  async function claim(id: string) {
    const email = prompt("Deine E-Mail (für die Bestätigung):")?.trim();
    if (!email) return;
    
    // Show loading state
    const claimButton = document.querySelector(`[data-item-id="${id}"] button`) as HTMLButtonElement | null;
    if (claimButton) {
      claimButton.textContent = "Wird reserviert...";
      claimButton.disabled = true;
    }
    
    try {
      const res = await fetch("/api/claim", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email }),
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.emailSent) {
          alert("✅ Reservierung erfolgreich! Bestätigungsmail wurde an " + email + " gesendet.");
        } else {
          alert("⚠️ Reservierung erfolgreich, aber E-Mail-Versand fehlgeschlagen. Bitte kontaktiere die Eltern.");
        }
      } else if (res.status === 409) {
        alert("❌ Leider schon reserviert.");
      } else {
        const errorText = await res.text();
        alert("❌ Fehler: " + errorText);
      }
    } catch {
      alert("❌ Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      // Restore button state
      if (claimButton) {
        claimButton.textContent = "Ich schenke das";
        claimButton.disabled = false;
      }
    }
  }

  async function addItem(form: FormData) {
    const code = adminCode ?? ""; if (!code) return alert("Admin-Code fehlt.");
    const payload = {
      item: String(form.get("item") ?? "").trim(),
      url: String(form.get("url") ?? "").trim() || undefined,
      price: String(form.get("price") ?? "").trim() || undefined,
      size: String(form.get("size") ?? "").trim() || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined,
    };
    if (!payload.item) return;
    const res = await fetch("/api/admin/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { alert("Konnte Item nicht speichern (Admin-Code korrekt?)."); return; }
    (document.getElementById("add-form") as HTMLFormElement)?.reset();
  }

  async function removeItem(id: string) {
    const code = adminCode ?? ""; if (!code) return;
    if (!confirm("Wirklich löschen?")) return;
    const res = await fetch("/api/admin/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) alert("Löschen fehlgeschlagen.");
  }

  function enableAdmin() {
    const code = prompt("Admin-Code eingeben:")?.trim(); if (!code) return;
    localStorage.setItem(ADMIN_FLAG, code); setAdminCode(code);
  }
  function disableAdmin() { localStorage.removeItem(ADMIN_FLAG); setAdminCode(null); }

  async function saveParentEmails() {
    const code = adminCode ?? ""; if (!code) return alert("Admin-Code fehlt.");
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ emails: parentEmails }),
    });
    if (res.ok) alert("Gespeichert."); else alert("Speichern fehlgeschlagen.");
  }

  async function checkEmailStatus() {
    const code = adminCode ?? ""; if (!code) return alert("Admin-Code fehlt.");
    
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ action: "status" }),
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setEmailStatus({ 
            valid: true, 
            message: `✅ E-Mail-Service funktioniert (${result.domains} Domains verfügbar)` 
          });
        } else {
          setEmailStatus({ 
            valid: false, 
            message: `❌ E-Mail-Service Problem: ${result.error}` 
          });
        }
      } else {
        setEmailStatus({ 
          valid: false, 
          message: "❌ Konnte E-Mail-Status nicht prüfen" 
        });
      }
    } catch {
      setEmailStatus({ 
        valid: false, 
        message: "❌ Netzwerkfehler beim Prüfen des E-Mail-Status" 
      });
    }
  }

  async function sendTestEmail() {
    const code = adminCode ?? ""; if (!code) return alert("Admin-Code fehlt.");
    if (!testEmail || !testItem) return alert("Bitte E-Mail und Test-Item eingeben.");
    
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ 
          action: "test", 
          email: testEmail, 
          itemName: testItem 
        }),
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          alert(`✅ Test-E-Mail erfolgreich gesendet an ${testEmail}`);
          setTestEmail("");
        } else {
          alert(`❌ Test-E-Mail fehlgeschlagen: ${result.error}`);
        }
      } else {
        alert("❌ Konnte Test-E-Mail nicht senden");
      }
    } catch {
      alert("❌ Netzwerkfehler beim Senden der Test-E-Mail");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-bold gradient-text">👶 Baby in Need</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Eine liebevolle Plattform für Baby-Geschenke. Schenkende können Items reservieren und Eltern werden automatisch benachrichtigt.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            {adminCode ? (
              <button 
                className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300" 
                onClick={disableAdmin}
              >
                🔐 Admin deaktivieren
              </button>
            ) : (
              <button 
                className="px-6 py-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300" 
                onClick={enableAdmin}
              >
                🔑 Admin aktivieren
              </button>
            )}
            <button 
              className="px-6 py-3 rounded-full bg-violet-500 hover:bg-violet-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300" 
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                alert("✅ Öffentlichen Link kopiert!");
              }}
            >
              📋 Link kopieren
            </button>
          </div>
        </header>

        {/* Game Section */}
        <StrollerGame />

        {/* Admin Sections */}
        {adminCode && (
          <>
            {/* Email Monitoring */}
            <section className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                📧 E-Mail-Überwachung
              </h2>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={checkEmailStatus} 
                  className="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
                >
                  🔍 E-Mail-Status prüfen
                </button>
                {emailStatus && (
                  <div className={`px-4 py-3 rounded-lg font-medium ${
                    emailStatus.valid 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {emailStatus.message}
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-700 mb-3">🧪 Test-E-Mail senden:</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <input 
                    value={testEmail} 
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="test@example.com" 
                  />
                  <input 
                    value={testItem} 
                    onChange={(e) => setTestItem(e.target.value)}
                    className="border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="Test-Geschenk" 
                  />
                  <button 
                    onClick={sendTestEmail} 
                    className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!testEmail || !testItem}
                  >
                    📤 Test-E-Mail senden
                  </button>
                </div>
              </div>
            </section>

            {/* Settings */}
            <section className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                ⚙️ Einstellungen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    📧 E-Mails der Beschenkten (Komma-getrennt)
                  </label>
                  <input 
                    value={parentEmails} 
                    onChange={(e) => setParentEmails(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="du@mail.ch, partner@mail.ch" 
                  />
                </div>
                <button 
                  onClick={saveParentEmails} 
                  className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
                >
                  💾 Speichern
                </button>
              </div>
            </section>

            {/* Add Item */}
            <section className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                ➕ Neues Item hinzufügen
              </h2>
              <form 
                id="add-form" 
                onSubmit={(e) => { e.preventDefault(); addItem(new FormData(e.currentTarget)); }}
                className="grid gap-4 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item *</label>
                  <input 
                    name="item" 
                    required 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="z.B. Tragetuch" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Link</label>
                  <input 
                    name="url" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="https://…" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Preis</label>
                  <input 
                    name="price" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="CHF …" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Grösse</label>
                  <input 
                    name="size" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="62/68, 0–3 M" 
                  />
                </div>
                <div className="md:col-span-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notizen</label>
                  <input 
                    name="notes" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300" 
                    placeholder="Farbe/Variante, Alternativen …" 
                  />
                </div>
                <div className="md:col-span-6">
                  <button 
                    type="submit" 
                    className="px-8 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    ➕ Hinzufügen
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {/* Items Grid */}
        <section className="grid gap-8 md:grid-cols-2">
          {/* Open Items */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
              🎁 Offen <span className="text-sm font-normal text-slate-500">({open.length})</span>
            </h2>
            {loading && <div className="text-slate-500 text-center py-8">⏳ Lädt…</div>}
            {!loading && open.length === 0 && (
              <div className="text-slate-500 text-center py-8">✨ Keine offenen Items.</div>
            )}
            <ul className="space-y-4">
              {open.map((i) => (
                <li key={i.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="space-y-3">
                    <div className="font-semibold text-lg text-slate-800">{i.item}</div>
                    <div className="flex flex-wrap gap-2">
                      {i.price && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          💰 {i.price}
                        </span>
                      )}
                      {i.size && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          📏 Grösse {i.size}
                        </span>
                      )}
                      {i.url && (
                        <a 
                          className="px-3 py-1 bg-violet-100 text-violet-800 rounded-full text-sm font-medium hover:bg-violet-200 transition-colors duration-300" 
                          href={i.url} 
                          target="_blank"
                        >
                          🔗 Zum Produkt
                        </a>
                      )}
                    </div>
                    {i.notes && (
                      <div className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                        📝 {i.notes}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300" 
                        onClick={() => claim(i.id)} 
                        data-item-id={i.id}
                      >
                        🎁 Ich schenke das
                      </button>
                      {adminCode && (
                        <button 
                          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300" 
                          onClick={() => removeItem(i.id)}
                        >
                          🗑️ Löschen
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Reserved Items */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-3">
              ✅ Reserviert <span className="text-sm font-normal text-slate-500">({reserved.length})</span>
            </h2>
            {!loading && reserved.length === 0 && (
              <div className="text-slate-500 text-center py-8">🎉 Noch nichts reserviert.</div>
            )}
            <ul className="space-y-4">
              {reserved.map((i) => (
                <li key={i.id} className="border border-slate-200 rounded-xl p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="space-y-3">
                    <div className="font-semibold text-lg text-slate-800">{i.item}</div>
                    <div className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                      📅 Reserviert am {new Date(i.claimed_at!).toLocaleDateString('de-CH')}
                    </div>
                    {adminCode && (
                      <button 
                        className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300" 
                        onClick={() => removeItem(i.id)}
                      >
                        🗑️ Löschen
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm py-8">
          <p>🔗 Öffentlichen Link teilen → Gäste können reservieren (ohne Login).</p>
        </footer>
      </div>
    </div>
  );
}
