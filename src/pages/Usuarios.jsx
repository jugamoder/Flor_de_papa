import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ChevronLeft, UserCheck, Edit2, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FONT = '"Inter", "SF Pro Display", system-ui, sans-serif';

export default function Usuarios() {
  const navigate = useNavigate();
  
  // Real-time query to fetch all local users
  const usuarios = useLiveQuery(() => db.usuarios.toArray()) || [];
  
  // Form states
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('Trabajador');
  const [editingUser, setEditingUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle submit (Create / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!username.trim()) {
      setErrorMsg('El nombre de usuario es obligatorio.');
      return;
    }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setErrorMsg('El PIN debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    try {
      if (editingUser) {
        // Edit Mode
        await db.usuarios.update(editingUser.id_usuario, {
          username: username.trim(),
          pin,
          rol
        });
        setEditingUser(null);
      } else {
        // Create Mode
        // Check if username already exists
        const exists = await db.usuarios.where('username').equalsIgnoreCase(username.trim()).first();
        if (exists) {
          setErrorMsg('Este nombre de usuario ya está registrado.');
          return;
        }

        await db.usuarios.add({
          username: username.trim(),
          pin,
          rol,
          estado: 'Activo',
          creadoEn: Date.now()
        });
      }

      // Reset form
      setUsername('');
      setPin('');
      setRol('Trabajador');
    } catch (err) {
      console.error(err);
      setErrorMsg('Hubo un error al guardar el usuario.');
    }
  };

  // Start editing a user
  const handleStartEdit = (u) => {
    setEditingUser(u);
    setUsername(u.username);
    setPin(u.pin);
    setRol(u.rol);
    setErrorMsg('');
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingUser(null);
    setUsername('');
    setPin('');
    setRol('Trabajador');
    setErrorMsg('');
  };

  // Toggle active/inactive status
  const handleToggleEstado = async (u) => {
    try {
      const nuevoEstado = u.estado === 'Activo' ? 'Inactivo' : 'Activo';
      await db.usuarios.update(u.id_usuario, { estado: nuevoEstado });
    } catch (err) {
      console.error('Error al cambiar estado del usuario:', err);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden text-white" style={{ background: '#080E1A', fontFamily: FONT }}>
      
      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4" style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.9) 0%, rgba(8,14,26,0) 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/')} 
              className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center hover:bg-white/15 transition active:scale-95"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Administrar Usuarios</h1>
              <p className="text-slate-500 text-[11px] mt-0.5">Control de acceso y roles del personal</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-400">
            Simulación Admin
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT (Scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
        
        {/* SECTION A: FORM CONTAINER */}
        <div className="bg-[#1A2438] border border-white/5 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <UserCheck size={16} className="text-indigo-400" />
            {editingUser ? 'Modificar Usuario' : 'Crear Usuario'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Nombre de Usuario</label>
                <input
                  type="text"
                  placeholder="Ej. juan.perez"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/60 text-white placeholder-slate-600 rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
                  required
                />
              </div>

              {/* PIN Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">PIN (4 Dígitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/60 text-white placeholder-slate-600 rounded-2xl px-4 py-3 text-sm outline-none transition-colors tracking-widest font-mono"
                  required
                />
              </div>
            </div>

            {/* Rol Dropdown Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Rol de Acceso</label>
              <div className="grid grid-cols-2 gap-3">
                {['Trabajador', 'Administrador'].map((r) => {
                  const isActive = rol === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRol(r)}
                      className="py-3 rounded-2xl text-xs font-black tracking-wider transition-all border uppercase"
                      style={{
                        background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                        borderColor: isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#818CF8' : '#64748B',
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {editingUser && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3.5 rounded-2xl text-slate-300 font-black text-sm tracking-wide transition-all active:scale-95 bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-3.5 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95"
                style={{
                  background: editingUser ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #4F46E5, #3730A3)',
                  boxShadow: editingUser ? '0 4px 15px rgba(16,185,129,0.25)' : '0 4px 15px rgba(79,70,229,0.25)'
                }}
              >
                {editingUser ? '💾 Guardar Cambios' : '➕ Crear Usuario'}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION B: REGISTERED USERS LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Usuarios Registrados
            </h3>
            <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {usuarios.length} total
            </span>
          </div>

          <div className="space-y-2.5">
            {usuarios.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm border border-dashed border-white/5 rounded-3xl">
                No hay usuarios registrados.
              </div>
            ) : (
              usuarios.map((u) => {
                const isAdmin = u.rol === 'Administrador';
                const isActive = u.estado === 'Activo';
                const isCurrentSimulatedAdmin = u.username === 'admin'; // Highlight default user
                
                return (
                  <div 
                    key={u.id_usuario}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#1A2438]/60 border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm"
                        style={{
                          background: isAdmin 
                            ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' 
                            : 'linear-gradient(135deg, #64748B, #475569)',
                          boxShadow: isAdmin 
                            ? '0 4px 10px rgba(37,99,235,0.2)' 
                            : '0 4px 10px rgba(100,116,139,0.2)'
                        }}
                      >
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-200">
                            {u.username}
                          </span>
                          {isCurrentSimulatedAdmin && (
                            <span className="text-[8px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1 py-0.5 rounded uppercase">
                              Admin Activo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Role Badge */}
                          <span 
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                              isAdmin 
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}
                          >
                            {u.rol}
                          </span>
                          
                          {/* Status Indicator */}
                          <span className="flex items-center text-[10px] text-slate-500">
                            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {u.estado}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleStartEdit(u)}
                        className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                        title="Editar usuario"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Enable/Disable Button */}
                      <button
                        onClick={() => handleToggleEstado(u)}
                        disabled={u.username === 'admin'} // Cannot disable default admin simulation
                        className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none`}
                        style={{
                          background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          borderColor: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                          color: isActive ? '#F87171' : '#34D399'
                        }}
                      >
                        {isActive ? 'Dar de Baja' : 'Activar'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
