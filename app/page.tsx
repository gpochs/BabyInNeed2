"use client";
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import StrollerGame from './components/StrollerGame';

// Ensure environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
}

const supabase = createClient(
  supabaseUrl || 'https://ksrgpydocqesasbnxmew.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmdweWRvY3Flc2FzYm54bWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTM5NDcsImV4cCI6MjA3MDUyOTk0N30.hAiYw1pcWDmOYn7Qju8xweCBdCQCKcNbGX8chXYVWlo'
);

interface Item {
  id: string;
  name: string;
  price: string;
  size: string;
  color: string;
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
  const [newItem, setNewItem] = useState<{
    name: string;
    price: string;
    size: string;
    color: string;
    notes: string;
    link: string;
    priority: 'low' | 'medium' | 'high';
    category: string;
  }>({
    name: '',
    price: '',
    size: '',
    color: '',
    notes: '',
    link: '',
    priority: 'medium',
    category: ''
  });

  // Load items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading items...'); // Debug log
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase load error:', error);
        throw error;
      }
      
      console.log('Items loaded:', data?.length || 0, 'items'); // Debug log
      
      // Ensure all items have required fields with fallbacks
      const safeItems = (data || []).map(item => ({
        id: item.id || '',
        name: item.name || '',
        price: item.price || '',
        size: item.size || '',
        color: item.color || '',
        notes: item.notes || '',
        link: item.link || '',
        status: item.status || 'offen',
        created_at: item.created_at || new Date().toISOString(),
        priority: item.priority || 'medium',
        category: item.category || ''
      }));
      
      setItems(safeItems);
      console.log('Safe items set:', safeItems.length); // Debug log
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]); // Set empty array on error
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

      if (!error && data && data.value && typeof data.value === 'string') {
        setEmailConfig(prev => ({ ...prev, recipients: data.value.trim() }));
      } else {
        // Fallback to default email if no config or invalid data
        setEmailConfig(prev => ({ ...prev, recipients: 'gianpeterochsner@gmail.com' }));
      }
    } catch (error) {
      console.error('Error loading email config:', error);
      // Fallback to default email
      setEmailConfig(prev => ({ ...prev, recipients: 'gianpeterochsner@gmail.com' }));
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
      console.log('Adding item:', newItem); // Debug log
      
      // Prepare item data - only include filled fields
      const itemData: {
        name: string;
        status: string;
        priority: string;
        price?: string;
        size?: string;
        color?: string;
        notes?: string;
        link?: string;
        category?: string;
      } = {
        name: newItem.name.trim(),
        status: 'offen',
        priority: newItem.priority
      };
      
      // Only add other fields if they have content
      if (newItem.price.trim()) itemData.price = newItem.price.trim();
      if (newItem.size.trim()) itemData.size = newItem.size.trim();
      if (newItem.color.trim()) itemData.color = newItem.color.trim();
      if (newItem.notes.trim()) itemData.notes = newItem.notes.trim();
      if (newItem.link.trim()) itemData.link = newItem.link.trim();
      if (newItem.category.trim()) itemData.category = newItem.category.trim();
      
      const { data, error } = await supabase
        .from('items')
        .insert(itemData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Item added successfully:', data); // Debug log
      
      await loadItems();
      setNewItem({
        name: '',
        price: '',
        size: '',
        color: '',
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
      alert(`Fehler beim Hinzufügen des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setAddItemLoading(false);
    }
  }, [newItem, loadItems]);

  // Delete item
  const deleteItem = useCallback(async (id: string) => {
    if (!confirm('Möchtest du dieses Item wirklich löschen?')) return;

    try {
      console.log('Deleting item with ID:', id); // Debug log
      
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      console.log('Item deleted successfully'); // Debug log
      await loadItems();
      alert('Item erfolgreich gelöscht!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(`Fehler beim Löschen des Items: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
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



  // Filter items
  const filteredItems = items.filter(item => {
    // Ensure all fields are strings before calling toLowerCase
    const itemName = String(item.name || '');
    const itemNotes = String(item.notes || '');
    const itemCategory = String(item.category || '');
    const searchTermSafe = String(searchTerm || '');
    
    const matchesSearch = itemName.toLowerCase().includes(searchTermSafe.toLowerCase()) ||
                         itemNotes.toLowerCase().includes(searchTermSafe.toLowerCase()) ||
                         itemCategory.toLowerCase().includes(searchTermSafe.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || itemCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openItems = filteredItems.filter(item => item.status === 'offen');
  const reservedItems = filteredItems.filter(item => item.status === 'reserviert');

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(
    items
      .map(item => String(item.category || ''))
      .filter(cat => cat && cat.trim() && cat !== 'undefined')
  ))];



  // Helper function to render link if valid
  const renderLink = (link: string | undefined) => {
    if (!link || !link.trim() || (!link.startsWith('http://') && !link.startsWith('https://'))) {
      return null;
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-slate-500">🔗</span>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 font-medium text-sm underline"
        >
          Link öffnen
        </a>
      </div>
    );
  };

  // Load data on mount
  useEffect(() => {
    loadItems();
    loadEmailConfig();
  }, [loadItems, loadEmailConfig]);

  // Check admin mode - removed automatic check, now using button

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-600 to-indigo-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-300 mx-auto mb-4"></div>
          <p className="text-slate-200 text-lg font-medium">Lade Items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-600 to-indigo-700">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-600 via-slate-500 to-indigo-600 shadow-2xl border-b border-slate-400 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="text-center sm:text-left mb-4 sm:mb-0">
                          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent drop-shadow-lg">
              🍼 Baby in Need
            </h1>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                <span className="text-2xl">👶</span>
                <span className="text-2xl">🍼</span>
                <span className="text-2xl">🧸</span>
                <span className="text-2xl">👕</span>
                <span className="text-2xl">🚼</span>
              </div>
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
                    className="px-3 py-2 border-2 border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white text-slate-800 font-medium placeholder-slate-500"
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
                    placeholder="Größe (z.B. 0-3 Monate)"
                    value={newItem.size}
                    onChange={(e) => setNewItem(prev => ({ ...prev, size: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                <input 
                    type="text"
                    placeholder="Farbe"
                    value={newItem.color}
                    onChange={(e) => setNewItem(prev => ({ ...prev, color: e.target.value }))}
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
                    onChange={(e) => setNewItem(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="low">Niedrige Priorität</option>
                    <option value="medium">Mittlere Priorität</option>
                    <option value="high">Hohe Priorität</option>
                  </select>
                  <input
                    type="url"
                    placeholder="Weblink (optional)"
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
            <h2 className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-lg">
              🟣 Offen ({openItems.length})
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
                <div key={item.id} className="bg-white rounded-xl shadow-2xl border-2 border-slate-300 p-6 hover:shadow-3xl transition-all duration-300 group">
                  {/* Priority Badge */}
                  {item.priority && (
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {item.priority === 'high' ? '🔥 Hoch' : 
                         item.priority === 'medium' ? '⚡ Mittel' : '🟣 Niedrig'}
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
                    {renderLink(item.link)}
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
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3 drop-shadow-lg">
            🟣 Reserviert ({reservedItems.length})
          </h2>
          
          {reservedItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-slate-200">
              <p className="text-slate-500 text-lg">Keine reservierten Items</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reservedItems.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-2xl border-2 border-slate-300 p-6 hover:shadow-3xl transition-all duration-300 opacity-90">
                  {/* Priority Badge */}
                  {item.priority && (
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {item.priority === 'high' ? '🔥 Hoch' : 
                         item.priority === 'medium' ? '⚡ Mittel' : '🟣 Niedrig'}
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
                    {renderLink(item.link)}
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
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3 drop-shadow-lg">
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
                Du möchtest <strong>&quot;{showClaimModal.itemName}&quot;</strong> reservieren?
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
