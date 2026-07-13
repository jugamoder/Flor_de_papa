import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Wallet, 
  ArrowUp, 
  ArrowDown, 
  PlusCircle, 
  MinusCircle, 
  X, 
  Trash2 
} from 'lucide-react';
import { db, SENTINEL_ID, resolveNombreSocio } from '../db/database';
import { useUser } from '../context/UserContext';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

export default function CajaChica() {
  const { currentUser } = useUser();
  const [modalType, setModalType] = useState(null); // 'ingreso' | 'egreso' | null
  const [montoInput, setMontoInput] = useState('');
  const [conceptoInput, setConceptoInput] = useState('');
  const [metodoInput, setMetodoInput] = useState('efectivo');
  const [filterMetodo, setFilterMetodo] = useState('todos'); // 'todos' | 'efectivo' | 'yape' | 'deposito'

  // Transfer states
  const [isTransfer, setIsTransfer] = useState(false);
  const [destUsuarioId, setDestUsuarioId] = useState('');

  // Dropdown filter state for Admin: 'general' (Consolidada) or user id
  const [selectedUserFilter, setSelectedUserFilter] = useState('general');

  // Load collections from DB
  const manualMovs = useLiveQuery(() => db.caja_manual.toArray());
  const transaccionesPago = useLiveQuery(() => db.transacciones_pago.toArray());
  const movimientos = useLiveQuery(() => db.movimientos.toArray());
  const socios = useLiveQuery(() => db.socios.toArray());
  
  // Load users to filter and target transfers
  const dbUsers = useLiveQuery(() => db.usuarios.filter(u => u.estado === 'Activo').toArray()) || [];

  // Map partners and movements
  const socioMap = useMemo(() => {
    if (!socios) return {};
    return Object.fromEntries(socios.map(s => [s.id_socio, s]));
  }, [socios]);

  const movMap = useMemo(() => {
    if (!movimientos) return {};
    return Object.fromEntries(movimientos.map(m => [m.uuid, m]));
  }, [movimientos]);

  // Determine which user's cash box is currently being viewed
  const activeBoxUserId = useMemo(() => {
    return currentUser.rol === 'Trabajador'
      ? currentUser.id_usuario
      : (selectedUserFilter === 'general' ? null : Number(selectedUserFilter));
  }, [currentUser, selectedUserFilter]);

  // Filter recipients dynamically based on who is logged in
  const availableDestinatarios = useMemo(() => {
    if (currentUser.rol === 'Administrador') {
      return dbUsers.filter(u => u.rol === 'Trabajador');
    } else {
      return dbUsers.filter(u => u.rol === 'Administrador');
    }
  }, [dbUsers, currentUser]);

  // Unified list and combined history
  const historialUnificado = useMemo(() => {
    if (!manualMovs || !transaccionesPago || !movimientos || !socios) return [];
    
    const list = [];

    // 1. Add manual moves
    manualMovs.forEach(item => {
      // Apply cashier operator filter
      if (activeBoxUserId !== null && item.id_usuario !== activeBoxUserId) return;
      
      list.push({
        id: `manual-${item.id}`,
        dbId: item.id,
        concepto: item.concepto,
        monto: Number(item.monto) || 0,
        metodo: item.metodo,
        fecha: item.fecha,
        timestamp: item.timestamp || 0,
        tipo: item.tipo, // 'ingreso' | 'egreso'
        esManual: true,
        id_usuario: item.id_usuario
      });
    });

    // 2. Add commercial payments
    transaccionesPago.forEach(item => {
      // Apply cashier operator filter
      if (activeBoxUserId !== null && item.id_usuario !== activeBoxUserId) return;

      const parentMov = movMap[item.id_movimiento];
      const tipoMov = parentMov?.tipo; // 'venta' | 'compra'
      const isTransbordo = parentMov?.es_transbordo === 1;

      // Determine type (ingreso/egreso)
      let tipoCaja = 'egreso';
      if (tipoMov === 'venta' || isTransbordo) {
        tipoCaja = 'ingreso';
      }

      // Resolve partner name
      let nombreSocio = 'Operación Comercial';
      if (parentMov) {
        nombreSocio = resolveNombreSocio(parentMov, socioMap);
      }

      // Resolve concept description
      let conceptoCaja = '';
      if (tipoMov === 'venta') {
        conceptoCaja = isTransbordo ? `Cobro - Transbordo (${nombreSocio})` : `Cobro - Venta Rápida (${nombreSocio})`;
      } else if (tipoMov === 'compra') {
        conceptoCaja = `Pago - Compra (${nombreSocio})`;
      } else {
        conceptoCaja = `Transacción Comercial (${nombreSocio})`;
      }

      list.push({
        id: `comm-${item.id_pago}`,
        dbId: item.id_pago,
        concepto: conceptoCaja,
        monto: Number(item.monto) || 0,
        metodo: item.metodo || 'efectivo',
        fecha: item.fecha,
        timestamp: item.timestamp || 0,
        tipo: tipoCaja,
        esManual: false,
        id_usuario: item.id_usuario
      });
    });

    // Sort chronologically descending
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [manualMovs, transaccionesPago, movimientos, socios, movMap, socioMap, activeBoxUserId]);

  // Totals based on payment method filter
  const { filteredEntradas, filteredSalidas, filteredBalance } = useMemo(() => {
    let entradas = 0;
    let salidas = 0;

    historialUnificado.forEach(item => {
      const match = filterMetodo === 'todos' || item.metodo?.toLowerCase() === filterMetodo;
      if (!match) return;

      if (item.tipo === 'ingreso') {
        entradas += item.monto;
      } else {
        salidas += item.monto;
      }
    });

    return {
      filteredEntradas: entradas,
      filteredSalidas: salidas,
      filteredBalance: entradas - salidas
    };
  }, [historialUnificado, filterMetodo]);

  // Filtered history to display
  const historialFiltrado = useMemo(() => {
    if (filterMetodo === 'todos') return historialUnificado;
    return historialUnificado.filter(item => item.metodo?.toLowerCase() === filterMetodo);
  }, [historialUnificado, filterMetodo]);

  const getBalanceTitle = () => {
    switch (filterMetodo) {
      case 'efectivo': return 'BALANCE EN EFECTIVO';
      case 'yape': return 'BALANCE EN YAPE';
      case 'deposito': return 'BALANCE EN DEPÓSITO';
      default: return 'BALANCE NETO DISPONIBLE';
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setIsTransfer(false);
    setDestUsuarioId('');
    if (filterMetodo !== 'todos') {
      setMetodoInput(filterMetodo);
    } else {
      setMetodoInput('efectivo');
    }
  };

  // Formatters
  const formatNumber = (num) => {
    return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getMethodEmoji = (metodo) => {
    switch (metodo?.toLowerCase()) {
      case 'yape': return '📱 Yape';
      case 'deposito': return '🏦 Depósito';
      default: return '💵 Efectivo';
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (ts, fechaStr) => {
    if (!ts) {
      if (!fechaStr) return '';
      const parts = fechaStr.split('-');
      return `${parts[2]}/${parts[1]}`;
    }
    const date = new Date(ts);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  // Submit hander (Includes Double Entry transfers)
  const handleSave = async (e) => {
    e.preventDefault();
    const parsedMonto = parseFloat(montoInput);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      alert('Por favor, ingrese un monto válido mayor a 0.');
      return;
    }

    if (!isTransfer || modalType !== 'egreso') {
      if (!conceptoInput.trim()) {
        alert('Por favor, ingrese el concepto del movimiento.');
        return;
      }
    } else {
      if (!destUsuarioId) {
        alert('Por favor, seleccione el usuario destinatario.');
        return;
      }
    }

    const hoyPeru = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

    try {
      if (isTransfer && modalType === 'egreso') {
        const targetUser = dbUsers.find(u => u.id_usuario === Number(destUsuarioId));
        if (!targetUser) {
          alert('El usuario de destino no es válido.');
          return;
        }

        await db.transaction('rw', db.caja_manual, async () => {
          if (currentUser.rol === 'Administrador') {
            // ADMIN -> WORKER
            // 1. Output from Admin
            await db.caja_manual.add({
              tipo: 'egreso',
              concepto: `Fondo entregado a: ${targetUser.username}`,
              monto: parsedMonto,
              metodo: metodoInput,
              fecha: hoyPeru,
              timestamp: Date.now(),
              id_usuario: currentUser.id_usuario
            });

            // 2. Input into Worker (Opening balance)
            await db.caja_manual.add({
              tipo: 'ingreso',
              concepto: `Monto de Apertura Recibido de Administrador`,
              monto: parsedMonto,
              metodo: metodoInput,
              fecha: hoyPeru,
              timestamp: Date.now() + 1,
              id_usuario: targetUser.id_usuario
            });
          } else {
            // WORKER -> ADMIN (Return balance / End shift)
            // 1. Output from Worker
            await db.caja_manual.add({
              tipo: 'egreso',
              concepto: `Devolución de fondos a Administrador`,
              monto: parsedMonto,
              metodo: metodoInput,
              fecha: hoyPeru,
              timestamp: Date.now(),
              id_usuario: currentUser.id_usuario
            });

            // 2. Input into Admin
            await db.caja_manual.add({
              tipo: 'ingreso',
              concepto: `Fondos devueltos por: ${currentUser.username}`,
              monto: parsedMonto,
              metodo: metodoInput,
              fecha: hoyPeru,
              timestamp: Date.now() + 1,
              id_usuario: targetUser.id_usuario
            });
          }
        });
      } else {
        // Standard Manual Move
        await db.caja_manual.add({
          tipo: modalType,
          concepto: conceptoInput.trim(),
          monto: parsedMonto,
          metodo: metodoInput,
          fecha: hoyPeru,
          timestamp: Date.now(),
          id_usuario: currentUser.id_usuario
        });
      }
      
      // Reset
      setMontoInput('');
      setConceptoInput('');
      setMetodoInput('efectivo');
      setIsTransfer(false);
      setDestUsuarioId('');
      setModalType(null);
    } catch (err) {
      console.error('Error al guardar movimiento de caja:', err);
      alert('Ocurrió un error al guardar el movimiento.');
    }
  };

  const handleDeleteManual = async (id, concepto) => {
    if (confirm(`¿Está seguro de eliminar el movimiento manual "${concepto}"?`)) {
      try {
        await db.caja_manual.delete(id);
      } catch (err) {
        console.error('Error al eliminar movimiento de caja:', err);
        alert('No se pudo eliminar el movimiento.');
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: '#080E1A', fontFamily: FONT }}>
      
      {/* HEADER */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-white/5" style={{ background: 'linear-gradient(180deg,rgba(30,41,59,0.9) 0%,rgba(8,14,26,0) 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-black tracking-tight leading-none flex items-center gap-2">
              <Wallet size={20} className="text-emerald-400" />
              Caja Chica
            </h1>
            <p className="text-slate-500 text-[10px] font-medium mt-1">Control de saldos y caja integrada</p>
          </div>

          {/* Admin Cash Box Selector */}
          {currentUser.rol === 'Administrador' && (
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500/50">
              <span className="text-[9px] font-black text-indigo-300 mr-1.5 uppercase tracking-wider">Filtrar Caja:</span>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="bg-transparent border-none text-white text-[10px] font-bold outline-none cursor-pointer"
              >
                <option value="general" style={{ background: '#111A2E' }}>Vista General</option>
                {dbUsers.map(u => (
                  <option key={u.id_usuario} value={u.id_usuario} style={{ background: '#111A2E' }}>
                    {u.username} ({u.rol.substring(0, 5)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {currentUser.rol === 'Trabajador' && (
          <p className="text-indigo-300 text-[9px] font-black uppercase tracking-wider mt-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-md inline-block">
            👤 Turno activo: {currentUser.username}
          </p>
        )}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        
        {/* Payment method filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-3 no-scrollbar">
          {[
            { k: 'todos', l: 'Todos' },
            { k: 'efectivo', l: '💵 Efectivo' },
            { k: 'yape', l: '📱 Yape' },
            { k: 'deposito', l: '🏦 Depósito' }
          ].map(({ k, l }) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterMetodo(k)}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 border outline-none"
              style={{
                backgroundColor: filterMetodo === k ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.03)',
                borderColor: filterMetodo === k ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.06)',
                color: filterMetodo === k ? '#4ade80' : '#94a3b8'
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* TOP BALANCE CARD */}
        <div className="rounded-3xl bg-[#091515] p-6 border border-[#142e2e] text-center shadow-lg shadow-[#091515]/50 transition-all">
          <p className="text-slate-400 text-[10px] sm:text-xs font-bold tracking-widest uppercase transition-all">
            {getBalanceTitle()}
          </p>
          <h2 className={`text-4xl sm:text-5xl font-mono font-bold drop-shadow-[0_0_10px_rgba(74,222,128,0.3)] my-3 transition-all ${
            filteredBalance >= 0 ? 'text-[#4ade80]' : 'text-rose-400'
          }`}>
            S/. {formatNumber(filteredBalance)}
          </h2>
          
          <div className="border-t border-[#142e2e]/60 my-4"></div>
          
          <div className="flex justify-around items-center pt-2">
            {/* Col 1: Inputs */}
            <div className="flex items-center space-x-2">
              <span className="text-[#4ade80] text-xl font-bold">↑</span>
              <div className="text-left">
                <p className="text-[#4ade80] text-[10px] font-bold tracking-wider">Entradas: S/.</p>
                <p className="text-[#4ade80] text-sm font-black font-mono">{formatNumber(filteredEntradas)}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 border-l border-[#142e2e]"></div>

            {/* Col 2: Outputs */}
            <div className="flex items-center space-x-2">
              <span className="text-rose-400 text-xl font-bold">↓</span>
              <div className="text-left">
                <p className="text-rose-400 text-[10px] font-bold tracking-wider">Salidas:</p>
                <p className="text-rose-400 text-sm font-black font-mono">S/. {formatNumber(filteredSalidas)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTION BUTTONS */}
        <div className="flex gap-3">
          <button
            onClick={() => openModal('ingreso')}
            className="flex-1 py-3.5 rounded-2xl bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80] text-xs font-black tracking-wide flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:bg-[#4ade80]/15"
          >
            <PlusCircle size={15} />
            Registrar Ingreso
          </button>
          <button
            onClick={() => openModal('egreso')}
            className="flex-1 py-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black tracking-wide flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:bg-rose-500/15"
          >
            <MinusCircle size={15} />
            Registrar Egreso
          </button>
        </div>

        {/* COMBINED HISTORY LIST */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-white text-xs font-black uppercase tracking-widest">Historial de Movimientos</span>
            <span className="text-slate-500 text-[10px] font-bold">
              {historialFiltrado.length === historialUnificado.length 
                ? `${historialUnificado.length} operaciones`
                : `${historialFiltrado.length} de ${historialUnificado.length} filtradas`}
            </span>
          </div>

          <div className="space-y-2">
            {historialFiltrado.length === 0 ? (
              <div className="text-center py-10 bg-white/3 border border-white/5 rounded-2xl">
                <p className="text-slate-500 text-xs">No hay movimientos registrados para este filtro.</p>
              </div>
            ) : (
              historialFiltrado.map((item) => {
                const isIngreso = item.tipo === 'ingreso';
                const operatorName = dbUsers.find(u => u.id_usuario === item.id_usuario)?.username || 'admin';
                
                return (
                  <div
                    key={item.id}
                    className="flex flex-col p-3 rounded-2xl border bg-white/3 border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Type icon */}
                      <div className={`w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center ${
                        isIngreso ? 'bg-[#4ade80]/15 text-[#4ade80]' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {isIngreso ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                      </div>

                      {/* Detail and Concept */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate leading-snug">{item.concepto}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 leading-none">
                            {getMethodEmoji(item.metodo)}
                          </span>
                          <span className="text-slate-600 text-[9px] font-bold">
                            {formatDate(item.timestamp, item.fecha)} · {formatTime(item.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Amount and delete button */}
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-black font-mono ${isIngreso ? 'text-[#4ade80]' : 'text-rose-400'}`}>
                          {isIngreso ? '+' : '-'} S/. {formatNumber(item.monto)}
                        </span>
                        {item.esManual && (
                          <button
                            onClick={() => handleDeleteManual(item.dbId, item.concepto)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 active:scale-90 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Operator Tag */}
                    <div className="flex items-center justify-between border-t border-white/3 pt-1.5 text-[9px] text-slate-500">
                      <span>👤 Operador: {operatorName}</span>
                      {item.concepto.includes('Apertura') && (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded font-black tracking-widest uppercase">APERTURA</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* TRANSACTIONS REGISTER MODAL */}
      {modalType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModalType(null)} />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-md bg-[#111A2E] rounded-3xl p-6 shadow-2xl border border-white/5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-white text-sm font-black uppercase tracking-wider">
                Registrar {modalType === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              
              {/* SWITCH TRANSFERENCIA - Only for egresos */}
              {modalType === 'egreso' && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/3 border border-white/5">
                  <span className="text-white text-xs font-bold">¿Es una transferencia de fondos?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isTransfer} 
                      onChange={(e) => {
                        setIsTransfer(e.target.checked);
                        setDestUsuarioId('');
                      }}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
              )}

              {/* AMOUNT */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Monto (S/.)</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-3 focus-within:border-indigo-500/50">
                  <span className="text-slate-400 font-bold text-sm mr-2">S/.</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={montoInput}
                    onChange={(e) => setMontoInput(e.target.value)}
                    className="w-full bg-transparent border-none text-white py-3 text-sm font-black font-mono outline-none"
                  />
                </div>
              </div>

              {/* CONCEPT OR RECIPIENT SELECTOR */}
              {isTransfer && modalType === 'egreso' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Seleccionar Usuario Destinatario</label>
                  <select
                    required
                    value={destUsuarioId}
                    onChange={(e) => setDestUsuarioId(e.target.value)}
                    className="w-full bg-[#111A2E] border border-white/10 text-white rounded-2xl px-3 py-3 text-xs outline-none focus:border-indigo-500/50"
                  >
                    <option value="" disabled>-- Seleccione un usuario --</option>
                    {availableDestinatarios.map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.username} ({u.rol})
                      </option>
                    ))}
                    {availableDestinatarios.length === 0 && (
                      <option value="" disabled>No hay usuarios de destino activos</option>
                    )}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Concepto</label>
                  <input
                    type="text"
                    required
                    placeholder={modalType === 'ingreso' ? 'Ej. Venta rápida de sacos vacíos, etc.' : 'Ej. Comida personal, estibadores, etc.'}
                    value={conceptoInput}
                    onChange={(e) => setConceptoInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-2xl px-3 py-3 text-xs outline-none focus:border-indigo-500/50"
                  />
                </div>
              )}

              {/* CAJA METHOD */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Método de Caja</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { k: 'efectivo', l: '💵 Efectivo' },
                    { k: 'yape', l: '📱 Yape' },
                    { k: 'deposito', l: '🏦 Depósito' }
                  ].map(({ k, l }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMetodoInput(k)}
                      className="py-2.5 rounded-xl text-xs font-black transition-all border outline-none active:scale-95"
                      style={{
                        backgroundColor: metodoInput === k ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                        borderColor: metodoInput === k ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                        color: metodoInput === k ? '#818cf8' : '#94a3b8'
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 py-3.5 rounded-2xl text-white text-xs font-bold transition-all active:scale-[0.98] ${
                  modalType === 'ingreso' ? 'bg-[#4ade80] hover:bg-[#3ec472] text-[#091515]' : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                Guardar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
