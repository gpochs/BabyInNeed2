"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">👶 Baby in Need</h1>
        <div className="flex items-center gap-2">
          {adminCode ? (
            <button className="px-3 py-1 border rounded" onClick={disableAdmin}>Admin deaktivieren</button>
          ) : (
            <button className="px-3 py-1 border rounded" onClick={enableAdmin}>Admin aktivieren</button>
          )}
          <button className="px-3 py-1 border rounded" onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            alert("Öffentlichen Link kopiert!");
          }}>Link kopieren</button>
        </div>
      </header>

      {adminCode && (
        <>
          <section className="border rounded-lg p-4 space-y-3">
            <div className="font-semibold">E-Mail-Überwachung</div>
            <div className="flex gap-2">
              <button onClick={checkEmailStatus} className="px-3 py-2 rounded bg-blue-600 text-white">
                E-Mail-Status prüfen
              </button>
              {emailStatus && (
                <div className={`px-3 py-2 rounded ${emailStatus.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {emailStatus.message}
                </div>
              )}
            </div>
            
            <div className="border-t pt-3 mt-3">
              <div className="text-sm mb-2">Test-E-Mail senden:</div>
              <div className="grid gap-2 md:grid-cols-3">
                <input 
                  value={testEmail} 
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="border rounded px-3 py-2" 
                  placeholder="test@example.com" 
                />
                <input 
                  value={testItem} 
                  onChange={(e) => setTestItem(e.target.value)}
                  className="border rounded px-3 py-2" 
                  placeholder="Test-Geschenk" 
                />
                <button 
                  onClick={sendTestEmail} 
                  className="px-3 py-2 rounded bg-green-600 text-white"
                  disabled={!testEmail || !testItem}
                >
                  Test-E-Mail senden
                </button>
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4 space-y-3">
            <div className="font-semibold">Einstellungen</div>
            <label className="text-sm">E-Mails der Beschenkten (Komma-getrennt)</label>
            <input value={parentEmails} onChange={(e) => setParentEmails(e.target.value)}
                   className="w-full border rounded px-3 py-2" placeholder="du@mail.ch, partner@mail.ch" />
            <button onClick={saveParentEmails} className="px-3 py-2 rounded bg-black text-white">Speichern</button>
          </section>

          <section className="border rounded-lg p-4 space-y-3">
            <div className="font-semibold">Neues Item hinzufügen</div>
            <form id="add-form" onSubmit={(e) => { e.preventDefault(); addItem(new FormData(e.currentTarget)); }}
                  className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="text-sm">Item*</label>
                <input name="item" required className="w-full border rounded px-3 py-2" placeholder="z.B. Tragetuch" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">Link</label>
                <input name="url" className="w-full border rounded px-3 py-2" placeholder="https://…" />
              </div>
              <div><label className="text-sm">Preis</label>
                <input name="price" className="w-full border rounded px-3 py-2" placeholder="CHF …" /></div>
              <div><label className="text-sm">Grösse</label>
                <input name="size" className="w-full border rounded px-3 py-2" placeholder="62/68, 0–3 M" /></div>
              <div className="md:col-span-6"><label className="text-sm">Notizen</label>
                <input name="notes" className="w-full border rounded px-3 py-2" placeholder="Farbe/Variante, Alternativen …" /></div>
              <div className="md:col-span-6"><button type="submit" className="px-4 py-2 rounded bg-black text-white">Hinzufügen</button></div>
            </form>
          </section>
        </>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-2">Offen</div>
          {loading && <div className="text-sm text-gray-500">Lädt…</div>}
          {!loading && open.length === 0 && <div className="text-sm text-gray-500">Keine offenen Items.</div>}
          <ul className="space-y-3">
            {open.map((i) => (
              <li key={i.id} className="border rounded p-3 flex items-start justify-between gap-3 hover:shadow-sm">
                <div>
                  <div className="font-medium">{i.item}</div>
                  <div className="text-sm text-gray-600 flex flex-wrap gap-2">
                    {i.price && <span className="px-2 py-0.5 border rounded">{i.price}</span>}
                    {i.size && <span className="px-2 py-0.5 border rounded">Grösse {i.size}</span>}
                    {i.url && <a className="underline" href={i.url} target="_blank">Zum Produkt</a>}
                  </div>
                  {i.notes && <div className="text-sm mt-1">{i.notes}</div>}
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded bg-black text-white" onClick={() => claim(i.id)} data-item-id={i.id}>Ich schenke das</button>
                  {adminCode && <button className="px-3 py-1 rounded border" onClick={() => removeItem(i.id)}>Löschen</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-2">Reserviert</div>
          {!loading && reserved.length === 0 && <div className="text-sm text-gray-500">Noch nichts reserviert.</div>}
          <ul className="space-y-3">
            {reserved.map((i) => (
              <li key={i.id} className="border rounded p-3 bg-gray-50">
                <div className="font-medium">{i.item}</div>
                <div className="text-sm text-gray-600">reserviert am {new Date(i.claimed_at!).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="text-xs text-gray-500">Öffentlichen Link teilen → Gäste können reservieren (ohne Login).</footer>
    </div>
  );
}
