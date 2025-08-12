"use client";
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import StrollerGame from './components/StrollerGame';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Item {
  id: number;
  name: string;
  price: string;
  size: string;
  notes: string;
  link?: string; // New: optional link field
  status: 'offen' | 'reserviert';
  created_at: string;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showGame, setShowGame] = useState(false); // New: toggle for game
  const [emailRecipients, setEmailRecipients] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  // Load items
  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load email recipients from config
  const loadEmailConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'email_recipients')
        .single();

      if (!error && data) {
        setEmailRecipients(data.value);
      }
    } catch (error) {
      console.error('Error loading email config:', error);
    }
  }, []);

  // Save email recipients to config
  const saveEmailConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const { error } = await supabase
        .from('config')
        .upsert({ 
          key: 'email_recipients', 
          value: emailRecipients 
        });

      if (error) throw error;
      alert('E-Mail-Empfänger gespeichert!');
    } catch (error) {
      console.error('Error saving email config:', error);
      alert('Fehler beim Speichern der E-Mail-Empfänger!');
    } finally {
      setConfigLoading(false);
    }
  }, [emailRecipients]);

  // Delete item
  const deleteItem = useCallback(async (id: number) => {
    if (!confirm('Möchtest du dieses Item wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadItems();
      alert('Item erfolgreich gelöscht!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Fehler beim Löschen des Items!');
    }
  }, [loadItems]);

  // Claim item
  const claimItem = useCallback(async (id: number) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ status: 'reserviert' })
        .eq('id', id);

      if (error) throw error;
      await loadItems();
      alert('Item erfolgreich reserviert!');
    } catch (error) {
      console.error('Error claiming item:', error);
      alert('Fehler beim Reservieren des Items!');
    }
  }, [loadItems]);

  // Load data on mount
  useEffect(() => {
    loadItems();
    loadEmailConfig();
  }, [loadItems, loadEmailConfig]);

  // Check admin mode
  useEffect(() => {
    if (adminCode === process.env.NEXT_PUBLIC_ADMIN_CODE) {
      setAdminMode(true);
      setAdminCode('');
    }
  }, [adminCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Lade Items...</p>
        </div>
      </div>
    );
  }

  const openItems = items.filter(item => item.status === 'offen');
  const reservedItems = items.filter(item => item.status === 'reserviert');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="text-center sm:text-left mb-4 sm:mb-0">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                🍼 Baby in Need
              </h1>
              <p className="text-slate-600 mt-2">Gemeinsam für Familien da</p>
            </div>
            
            {/* Admin Access */}
            <div className="flex items-center space-x-4">
              {!adminMode && (
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    placeholder="Admin-Code"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}
              {adminMode && (
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">👑 Admin-Modus</span>
                  <button
                    onClick={() => setAdminMode(false)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Beenden
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Offene Items */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            🟢 Offen ({openItems.length})
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {openItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
                {/* Item Name - Prominent and Large */}
                <h3 className="text-xl font-bold text-slate-800 mb-3 leading-tight">
                  {item.name}
                </h3>
                
                {/* Item Details */}
                <div className="space-y-2 mb-4">
                  {item.price && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">💰</span>
                      <span className="text-slate-700 font-medium">{item.price}</span>
                    </div>
                  )}
                  {item.size && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">📏</span>
                      <span className="text-slate-700 font-medium">{item.size}</span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 mt-1">📝</span>
                      <span className="text-slate-700 text-sm leading-relaxed">{item.notes}</span>
                    </div>
                  )}
                  {item.link && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">🔗</span>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm underline"
                      >
                        Link öffnen
                      </a>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => claimItem(item.id)}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    🎯 Reservieren
                  </button>
                  {adminMode && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {openItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">Keine offenen Items verfügbar</p>
            </div>
          )}
        </section>

        {/* Reservierte Items */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            🟡 Reserviert ({reservedItems.length})
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reservedItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-shadow">
                {/* Item Name - Prominent and Large */}
                <h3 className="text-xl font-bold text-slate-800 mb-3 leading-tight">
                  {item.name}
                </h3>
                
                {/* Item Details */}
                <div className="space-y-2 mb-4">
                  {item.price && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">💰</span>
                      <span className="text-slate-700 font-medium">{item.price}</span>
                    </div>
                  )}
                  {item.size && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">📏</span>
                      <span className="text-slate-700 font-medium">{item.size}</span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 mt-1">📝</span>
                      <span className="text-slate-700 text-sm leading-relaxed">{item.notes}</span>
                    </div>
                  )}
                  {item.link && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">🔗</span>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm underline"
                      >
                        Link öffnen
                      </a>
                    </div>
                  )}
                </div>

                {/* Admin Delete Button */}
                {adminMode && (
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    🗑️ Löschen
                  </button>
                )}
              </div>
            ))}
          </div>
          {reservedItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">Keine reservierten Items</p>
            </div>
          )}
        </section>

        {/* E-Mails der Beschenkten - Admin Only */}
        {adminMode && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              📧 E-Mails der Beschenkten
            </h2>
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    E-Mail-Adressen (kommagetrennt)
                  </label>
                  <textarea
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={saveEmailConfig}
                  disabled={configLoading}
                  className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50"
                >
                  {configLoading ? 'Speichere...' : '💾 Speichern'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Stadt-Labyrinth Spiel - Toggle Button */}
        <section className="mb-12">
          <div className="text-center mb-6">
            <button
              onClick={() => setShowGame(!showGame)}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 mx-auto"
            >
              {showGame ? '🎮 Spiel ausblenden' : '🎮 Stadt-Labyrinth Spiel'}
              {showGame ? '👆' : '👇'}
            </button>
          </div>
          
          {/* Game Container */}
          {showGame && (
            <div className="animate-fadeIn">
              <StrollerGame />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
