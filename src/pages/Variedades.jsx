import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ChevronLeft, Plus, Trash2, X, Leaf, Pipette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FONT = '"Inter", "SF Pro Display", system-ui, sans-serif';

/* ── Color Picker — solo nativo + HEX, sin paleta ── */
function ColorPicker({ value, onChange }) {
  const nativeRef = useRef(null);

  return (
    <div className="flex items-center space-x-3">
      {/* Swatch cuadrado que abre el picker nativo del SO */}
      <button
        type="button"
        onClick={() => nativeRef.current?.click()}
        className="w-14 h-14 rounded-2xl flex-shrink-0 shadow-lg ring-2 ring-white/10 hover:ring-white/30 transition-all flex items-center justify-center"
        style={{ backgroundColor: value }}
        title="Toca para abrir el selector de color"
      >
        <Pipette size={18} className="text-white drop-shadow" />
      </button>

      {/* Input nativo oculto */}
      <input
        ref={nativeRef}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
      />

      {/* Campo HEX */}
      <div className="flex-1 relative">
        <span className="absolute left-4 inset-y-0 flex items-center text-slate-400 text-sm font-mono">#</span>
        <input
          type="text"
          maxLength={6}
          value={value.replace('#', '').toUpperCase()}
          onChange={e => {
            const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
            if (hex.length === 6) onChange('#' + hex);
          }}
          placeholder="RRGGBB"
          className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 text-white rounded-2xl pl-9 pr-4 py-3 text-sm font-mono outline-none transition-colors tracking-widest"
        />
      </div>
    </div>
  );
}

/* ── Add Form (Bottom Sheet) ── */
function AddVariedadSheet({ onClose }) {
  const [form, setForm] = useState({
    nombre: '',
    codigo_corto: '',
    color: '#EF4444',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.codigo_corto.trim()) return;
    setSaving(true);
    try {
      await db.variedades.add({
        nombre:       form.nombre.trim(),
        codigo_corto: form.codigo_corto.trim().toUpperCase(),
        color:        form.color,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const canSave = form.nombre.trim() && form.codigo_corto.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-16">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{ background: '#1A2438', maxHeight: 'calc(90vh - 64px)' }}
      >
        {/* Handle */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5">
          <h2 className="text-white font-bold text-base">Nueva Variedad</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2 space-y-4 min-h-0">

          {/* Preview badge en vivo */}
          <div
            className="flex items-center space-x-4 p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="min-w-[3rem] px-2 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0"
              style={{ backgroundColor: form.color, boxShadow: `0 4px 14px ${form.color}60` }}
            >
              {form.codigo_corto || '?'}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{form.nombre || 'Nombre y tamaño de la variedad'}</p>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1.5">
              Nombre y tamaño de la Variedad
            </label>
            <input
              type="text"
              placeholder="Ej: Canchán primera, Amarilla segunda..."
              className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 text-white placeholder-slate-600 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            />
          </div>

          {/* Código corto */}
          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1.5">
              Código Corto{' '}
              <span className="text-slate-600 normal-case font-normal tracking-normal">(1–8 letras/números)</span>
            </label>
            <input
              type="text"
              maxLength={8}
              placeholder="Ej: C1, HY, A1"
              className="w-full bg-white/5 border border-white/10 focus:border-blue-500/60 text-white placeholder-slate-600 rounded-2xl px-4 py-3 text-sm font-mono uppercase tracking-widest outline-none transition-colors"
              value={form.codigo_corto}
              onChange={e =>
                setForm(f => ({ ...f, codigo_corto: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))
              }
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-3">
              Color Distintivo
            </label>
            <ColorPicker
              value={form.color}
              onChange={color => setForm(f => ({ ...f, color }))}
            />
          </div>

        </div>

        {/* Sticky Save Button — siempre visible */}
        <div className="flex-shrink-0 px-5 pt-3 pb-6 border-t border-white/5">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-3.5 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              boxShadow: '0 4px 15px rgba(37,99,235,0.35)',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar Variedad'}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Variedades() {
  const navigate = useNavigate();
  const variedades = useLiveQuery(() => db.variedades.orderBy('nombre').toArray()) || [];
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleDelete = async (id) => {
    await db.variedades.delete(id);
    setConfirmDelete(null);
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: '#080E1A', fontFamily: FONT }}>

      {showForm && <AddVariedadSheet onClose={() => setShowForm(false)} />}

      {/* Confirm delete */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 text-center"
            style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <h3 className="text-white font-bold text-base mb-2">¿Eliminar variedad?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Puede afectar registros históricos vinculados a esta variedad.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-2xl text-slate-300 font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm active:scale-95 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.9) 0%, rgba(8,14,26,0) 100%)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center hover:bg-white/15 transition"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Variedades</h1>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {variedades.length} registrada{variedades.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            <Plus size={16} />
            <span>Nueva</span>
          </button>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 min-h-0 pt-3">
        {variedades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 space-y-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <Leaf size={24} className="text-slate-700" />
            </div>
            <p className="text-slate-600 text-sm font-medium">No hay variedades registradas</p>
            <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-bold">
              + Agregar la primera
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {variedades.map(variedad => (
              <div
                key={variedad.id_variedad}
                className="flex items-center space-x-4 px-4 py-3.5 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Color badge */}
                <div
                  className="min-w-[3rem] px-2 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-lg"
                  style={{
                    backgroundColor: variedad.color || '#6366f1',
                    boxShadow: `0 4px 14px ${variedad.color || '#6366f1'}50`,
                  }}
                >
                  {variedad.codigo_corto}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{variedad.nombre}</p>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: variedad.color }} />
                    <span className="text-slate-700 text-[10px] font-mono">
                      {(variedad.color || '').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => setConfirmDelete(variedad.id_variedad)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)' }}
                >
                  <Trash2 size={15} className="text-red-400/70" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
