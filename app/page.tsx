"use client";
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import StrollerGame from './components/StrollerGame';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Item {
  id: string;
  name: string;
  price: string;
  size: string;
  notes: string;
  link?: string;
  status: 'offen' | 'reserviert';
  created_at: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
}

interface EmailConfig {
  recipients: string;
  notifyOnClaim: boolean;
  customMessage?: string;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showGame, setShowGame] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClaimModal, setShowClaimModal] = useState<{ show: boolean; itemId: string; itemName: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    recipients: 'gianpeterochsner@gmail.com',
    notifyOnClaim: true
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [addItemSuccess, setAddItemSuccess] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    size: '',
    notes: '',
    link: '',
    priority: 'medium' as const,
    category: ''
  });

  // Load items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
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

  // Load email config
  const loadEmailConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'email_recipients')
        .single();

      if (!error && data) {
        setEmailConfig(prev => ({ ...prev, recipients: data.value }));
      }
    } catch (error) {
      console.error('Error loading email config:', error);
    }
  }, []);

  // Save email config
  const saveEmailConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const { error } = await supabase
        .from('config')
        .upsert({ 
          key: 'email_recipients', 
          value: emailConfig.recipients 
        });

      if (error) throw error;
      alert('E-Mail-Empfänger gespeichert!');
    } catch (error) {
      console.error('Error saving email config:', error);
      alert('Fehler beim Speichern der E-Mail-Empfänger!');
    } finally {
      setConfigLoading(false);
    }
  }, [emailConfig.recipients]);

  // Add new item
  const addItem = useCallback(async () => {
    if (!newItem.name.trim()) {
      alert('Bitte gib einen Namen für das Item ein!');
      return;
    }

    setAddItemLoading(true);
    try {
      const { error } = await supabase
        .from('items')
        .insert({
          name: newItem.name.trim(),
          price: newItem.price.trim() || null,
          size: newItem.size.trim() || null,
          notes: newItem.notes.trim() || null,
          link: newItem.link.trim() || null,
          priority: newItem.priority,
          category: newItem.category.trim() || null,
          status: 'offen'
        });

      if (error) throw error;
      
      await loadItems();
      setNewItem({
        name: '',
        price: '',
        size: '',
        notes: '',
        link: '',
        priority: 'medium',
        category: ''
      });
      setShowAddForm(false);
      setAddItemSuccess(true);
      setTimeout(() => setAddItemSuccess(false), 3000);
      alert('Item erfolgreich hinzugefügt!');
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Fehler beim Hinzufügen des Items!');
    } finally {
      setAddItemLoading(false);
    }
  }, [newItem, loadItems]);

  // Delete item
  const deleteItem = useCallback(async (id: string) => {
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

  // Claim item with email
  const claimItemWithEmail = useCallback(async (id: string, email: string) => {
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      await loadItems();
      alert(`Item "${result.item}" erfolgreich reserviert! Du erhältst eine Bestätigungsmail.`);
    } catch (error) {
      console.error('Error claiming item:', error);
      alert('Fehler beim Reservieren des Items! Bitte versuche es erneut.');
    }
  }, [loadItems]);

  // Claim item (legacy function - keeping for compatibility)
  const claimItem = useCallback(async (id: string) => {
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

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openItems = filteredItems.filter(item => item.status === 'offen');
  const reservedItems = filteredItems.filter(item => item.status === 'reserviert');

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(items.map(item => item.category).filter(Boolean)))];

  // Load data on mount
  useEffect(() => {
    loadItems();
    loadEmailConfig();
  }, [loadItems, loadEmailConfig]);

  // Check admin mode - removed automatic check, now using button

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-slate-200 sticky top-0 z-50">
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
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={() => {
                      if (adminCode === 'baby2025') {
                        setAdminMode(true);
                        setAdminCode('');
                      } else {
                        alert('Falscher Admin-Code!');
                        setAdminCode('');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
                  >
                    🔐 Anmelden
                  </button>
                </div>
              )}
              {adminMode && (
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">👑 Admin-Modus</span>
                  <button
                    onClick={() => setAdminMode(false)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
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
        {/* Success Message */}
        {addItemSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-2xl">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Item erfolgreich hinzugefügt!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  🔍 Suche
                </label>
                <input
                  type="text"
                  placeholder="Nach Items suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📂 Kategorie
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'Alle Kategorien' : category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Add Button */}
              {adminMode && (
                <div className="flex items-end">
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                  >
                    {showAddForm ? '❌ Abbrechen' : '➕ Item hinzufügen'}
              </button>
                </div>
              )}
            </div>
            
            {/* Add Item Form */}
            {showAddForm && adminMode && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Neues Item hinzufügen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Preis"
                    value={newItem.price}
                    onChange={(e) => setNewItem(prev => ({ ...prev, price: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                <input 
                    type="text"
                    placeholder="Größe"
                    value={newItem.size}
                    onChange={(e) => setNewItem(prev => ({ ...prev, size: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input 
                    type="text"
                    placeholder="Kategorie"
                    value={newItem.category}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <select
                    value={newItem.priority}
                    onChange={(e) => setNewItem(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="low">Niedrige Priorität</option>
                    <option value="medium">Mittlere Priorität</option>
                    <option value="high">Hohe Priorität</option>
                  </select>
                  <input
                    type="url"
                    placeholder="Link (optional)"
                    value={newItem.link}
                    onChange={(e) => setNewItem(prev => ({ ...prev, link: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="mt-4">
                  <textarea
                    placeholder="Notizen"
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                <button 
                    onClick={addItem}
                    disabled={addItemLoading}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50"
                  >
                    {addItemLoading ? 'Speichere...' : '💾 Item speichern'}
                </button>
                </div>
              </div>
            )}
            </div>
          </section>

        {/* Offene Items */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              🟢 Offen ({openItems.length})
            </h2>
            {openItems.length > 0 && (
              <div className="text-sm text-slate-500">
                {openItems.filter(item => item.priority === 'high').length} hohe Priorität
              </div>
            )}
          </div>
          
          {openItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-slate-200">
              <p className="text-slate-500 text-lg">Keine offenen Items verfügbar</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {openItems.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 group">
                  {/* Priority Badge */}
                  {item.priority && (
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.priority === 'high' ? '🔥 Hoch' : 
                         item.priority === 'medium' ? '⚡ Mittel' : '✅ Niedrig'}
                      </div>
                      {item.category && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                          {item.category}
                        </span>
                      )}
              </div>
                  )}

                  {/* Item Name */}
                  <h3 className="text-xl font-bold text-slate-800 mb-3 leading-tight group-hover:text-indigo-600 transition-colors">
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
                      onClick={() => setShowClaimModal({ show: true, itemId: item.id, itemName: item.name })}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium hover:scale-105 transform"
                    >
                      🎯 Reservieren
                    </button>
                    {adminMode && (
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors hover:scale-105 transform"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reservierte Items */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            🟡 Reserviert ({reservedItems.length})
          </h2>
          
          {reservedItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-slate-200">
              <p className="text-slate-500 text-lg">Keine reservierten Items</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reservedItems.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 opacity-75">
                  {/* Priority Badge */}
                  {item.priority && (
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.priority === 'high' ? '🔥 Hoch' : 
                         item.priority === 'medium' ? '⚡ Mittel' : '✅ Niedrig'}
                      </div>
                      {item.category && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                          {item.category}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Item Name */}
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
                      className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium hover:scale-105 transform"
                    >
                      🗑️ Löschen
                    </button>
                  )}
                </div>
            ))}
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
                    value={emailConfig.recipients}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, recipients: e.target.value }))}
                    placeholder="email1@example.com, email2@example.com"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={saveEmailConfig}
                  disabled={configLoading}
                  className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50 hover:scale-105 transform"
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
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3 mx-auto hover:scale-105 transform"
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

        {/* Reservierungs-Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                🎯 Item reservieren
              </h3>
              <p className="text-slate-600 mb-4">
                Du möchtest <strong>"{showClaimModal.itemName}"</strong> reservieren?
              </p>
              <p className="text-slate-600 mb-4">
                Bitte gib deine E-Mail-Adresse ein, um eine Bestätigung zu erhalten.
              </p>
              <input
                type="email"
                placeholder="deine@email.ch"
                id="claimEmail"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClaimModal(null)}
                  className="flex-1 px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    const email = (document.getElementById('claimEmail') as HTMLInputElement).value;
                    if (!email || !/.+@.+\..+/.test(email)) {
                      alert('Bitte gib eine gültige E-Mail-Adresse ein!');
                      return;
                    }
                    setShowClaimModal(null);
                    await claimItemWithEmail(showClaimModal.itemId, email);
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  Reservieren
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
