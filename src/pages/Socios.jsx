import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { SENTINEL_ID } from '../db/database';
import {
  ChevronLeft, Plus, Trash2, Phone, CreditCard,
  Users, X, Search, UserCheck, ShoppingCart, ArrowLeftRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ── Helpers ── */
const FONT = '"Inter", "SF Pro Display", system-ui, sans-serif';

function RolBadge({ label, colorClass }) {
  return (
    <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase border ${colorClass}`}>
      {label}
    </span>
  );
}

function Avatar({ nombre, size = 40 }) {
  const initials = nombre
    ? nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';
  // Generate a stable hue from the name
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-2xl font-black text-white"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, hsl(${hue},65%,40%), hsl(${hue},80%,30%))`,
        fontSize: size * 0.35,
        boxShadow: `0 4px 12px hsl(${hue},65%,25%,0.4)`,
      }}
    >
      {initials}
    </div>
  );
}

/* ── Add Form (Bottom Sheet) ── */
function AddSocioSheet({ onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: '', documento: '', telefono: '', tipo: 'ambos' });
  const [saving, setSaving] = useState(false);

  const TIPOS = [
    { key: 'proveedor', label: 'Proveedor', icon: ShoppingCart },
    { key: 'cliente',   label: 'Cliente',   icon: UserCheck },
    { key: 'ambos',     label: 'Ambos',     icon: ArrowLeftRight },
  ];

  // Stable handlers to avoid re-renders that lose focus
  const setNombre    = useCallback(e => setForm(f => ({ ...f, nombre:    e.target.value })), []);
  const setDocumento = useCallback(e => setForm(f => ({ ...f, documento: e.target.value })), []);
  const setTelefono  = useCallback(e => setForm(f => ({ ...f, telefono:  e.target.value })), []);

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const id = await db.socios.add({
        nombre:       form.nombre.trim(),
        documento:    form.documento.trim(),
        telefono:     form.telefono.trim(),
        es_proveedor: form.tipo === 'proveedor' || form.tipo === 'ambos' ? 1 : 0,
        es_cliente:   form.tipo === 'cliente'   || form.tipo === 'ambos' ? 1 : 0,
        es_ocasional: 0,
        saldo_actual: 0,
      });
      onSaved?.({ id_socio: id, nombre: form.nombre.trim() });
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-16">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--overlay-backdrop)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl flex flex-col shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-card)', maxHeight: 'calc(90vh - 64px)' }}>
        {/* Handle */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--text-tertiary)' }} />
        </div>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Registrar Socio</h2>
          <button onClick={onClose} className="p-2 rounded-full transition" style={{ background: 'var(--white-alpha-5)', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2">
          {/* Nombre */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nombre / Razón Social</label>
            <input
              type="text"
              placeholder="Ej: Juan Quispe Mamani"
              className="w-full border focus:border-blue-500/60 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
              value={form.nombre}
              onChange={setNombre}
            />
          </div>
          {/* DNI */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>DNI / RUC <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <input
              type="text"
              placeholder="Ej: 12345678"
              className="w-full border focus:border-blue-500/60 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
              value={form.documento}
              onChange={setDocumento}
            />
          </div>
          {/* Teléfono */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <input
              type="tel"
              placeholder="Ej: 999 888 777"
              className="w-full border focus:border-blue-500/60 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
              value={form.telefono}
              onChange={setTelefono}
            />
          </div>

          {/* Rol selector */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
              Relación Comercial
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(t => {
                const Icon = t.icon;
                const active = form.tipo === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.key })}
                    className="flex flex-col items-center py-3 rounded-2xl font-bold text-xs transition-all border outline-none font-sans"
                    style={{
                      background: active ? 'rgba(59,130,246,0.2)' : 'var(--white-alpha-3)',
                      borderColor: active ? 'rgba(59,130,246,0.5)' : 'var(--border-subtle)',
                      color: active ? '#60A5FA' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={18} className="mb-1.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
        {/* Sticky Save Button */}
        <div className="flex-shrink-0 px-5 pt-3 pb-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleSave}
            disabled={!form.nombre.trim() || saving}
            className="w-full py-3.5 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 15px rgba(37,99,235,0.35)' }}
          >
            {saving ? 'Guardando…' : 'Guardar Socio'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Socios() {
  const navigate = useNavigate();
  const socios = useLiveQuery(() => db.socios.orderBy('nombre').toArray()) || [];
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState('todos');
  const [confirmDelete, setConfirmDelete] = useState(null); // id

  const FILTERS = [
    { key: 'todos',      label: 'Todos' },
    { key: 'proveedor',  label: 'Proveedores' },
    { key: 'cliente',    label: 'Clientes' },
  ];

  const sociosFiltrados = useMemo(() => {
    let list = socios.filter(s =>
      s.es_ocasional !== 1 &&      // excluir ocasionales legacy
      s.id_socio !== SENTINEL_ID   // excluir el centinela del sistema
    );
    if (filterRol === 'proveedor') list = list.filter(s => s.es_proveedor === 1);
    if (filterRol === 'cliente')   list = list.filter(s => s.es_cliente === 1);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.nombre?.toLowerCase().includes(q) ||
        s.documento?.toLowerCase().includes(q) ||
        s.telefono?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [socios, filterRol, search]);

  const handleDelete = async (id) => {
    // Proteger el registro centinela del sistema
    if (id === SENTINEL_ID) return;
    await db.socios.delete(id);
    setConfirmDelete(null);
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: 'var(--surface-base)', color: 'var(--text-primary)', fontFamily: FONT }}>

      {/* Add sheet */}
      {showForm && <AddSocioSheet onClose={() => setShowForm(false)} />}

      {/* Confirm delete */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--overlay-backdrop)' }} onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-card)' }}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500 dark:text-red-400" />
            </div>
            <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>¿Eliminar socio?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm active:scale-95 transition-all">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3" style={{ background: 'linear-gradient(180deg, var(--gradient-header-start) 0%, var(--gradient-header-end) 100%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center transition" style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)' }}>
              <ChevronLeft size={20} style={{ color: 'var(--text-primary)' }} />
            </button>
            <div>
              <h1 className="font-bold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>Socios</h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{socios.length} registrado{socios.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
          >
            <Plus size={16} />
            <span>Nuevo</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Buscar socio, DNI, teléfono..."
            className="w-full pl-9 pr-9 py-2.5 text-sm outline-none rounded-xl transition-colors"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex space-x-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterRol(f.key)}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all font-sans"
              style={{
                background: filterRol === f.key ? 'var(--filter-tab-active-bg)' : 'var(--filter-tab-bg)',
                color: filterRol === f.key ? 'var(--filter-tab-active-text)' : 'var(--filter-tab-text)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 min-h-0 pt-3">
        {sociosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 space-y-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--white-alpha-5)' }}>
              <Users size={24} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {search ? `Sin resultados para "${search}"` : 'No hay socios registrados'}
            </p>
            <button onClick={() => setShowForm(true)} className="text-blue-500 dark:text-blue-400 text-sm font-bold">
              + Agregar el primero
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sociosFiltrados.map(socio => (
              <div
                key={socio.id_socio}
                className="flex items-center space-x-4 px-4 py-3.5 rounded-2xl transition-all"
                style={{ background: 'var(--white-alpha-3)', border: '1px solid var(--border-subtle)' }}
              >
                <Avatar nombre={socio.nombre || '?'} size={44} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate mb-1" style={{ color: 'var(--text-primary)' }}>{socio.nombre}</p>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {socio.es_proveedor === 1 && (
                      <RolBadge label="Prov" colorClass="bg-blue-500/15 text-blue-450 dark:text-blue-400 border-blue-500/25" />
                    )}
                    {socio.es_cliente === 1 && (
                      <RolBadge label="Clie" colorClass="bg-emerald-500/15 text-emerald-550 dark:text-emerald-400 border-emerald-500/25" />
                    )}
                    {socio.telefono && (
                      <span className="flex items-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <Phone size={9} className="mr-0.5" />{socio.telefono}
                      </span>
                    )}
                    {socio.documento && (
                      <span className="flex items-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <CreditCard size={9} className="mr-0.5" />{socio.documento}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setConfirmDelete(socio.id_socio)}
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
