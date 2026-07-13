import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search, PackageMinus, PackagePlus, X, Edit2, Clock, Layers, Users, Leaf, ChevronRight, ChevronLeft, ArrowLeftRight, Landmark, UserCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, genUUID, SENTINEL_ID, getOcasionalCorrelativo } from '../db/database';
import { useUser } from '../context/UserContext';const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

/* ─── Contraste dinámico para textos sobre fondo de color ─── */
function getLuminance(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2),16)/255;
  const g = parseInt(c.slice(2,4),16)/255;
  const b = parseInt(c.slice(4,6),16)/255;
  const toLinear = x => x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4);
  return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
}
function textOnBg(hex) {
  if (!hex || hex.length < 7) return '#ffffff';
  return getLuminance(hex) > 0.35 ? '#0f172a' : '#ffffff';
}

/* ─── Badge helpers ─── */
const TipoBadge = ({ tipo, esTransbordo }) => (
  <span className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md uppercase ${
    esTransbordo
      ? 'bg-amber-600/30 text-amber-300'
      : (tipo === 'compra'
          ? 'bg-blue-500/20 text-blue-300'
          : 'bg-emerald-500/20 text-emerald-300')
  }`}>
    {esTransbordo ? 'Transbordo' : (tipo === 'compra' ? 'Compra' : 'Venta')}
  </span>
);

const EstadoBadge = ({ estado }) => {
  const map = {
    activo:    'bg-amber-500/20 text-amber-300',
    finalizado:'bg-slate-500/20 text-slate-400',
    borrador:  'bg-slate-700/30 text-slate-500',
  };
  const label = { activo: 'Activo', finalizado: 'Cerrado', borrador: 'Borrador' };
  return (
    <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md ${map[estado] || map.borrador}`}>
      {label[estado] || estado}
    </span>
  );
};

/* ─── Resolver nombre de socio (soporta centinela) ─── */
function resolveNombreSocio(mov, socios) {
  // Operación rápida: el nombre completo ya está formateado en socio_nombre_temporal
  if (mov.id_socio === SENTINEL_ID) {
    return mov.socio_nombre_temporal || (mov.tipo === 'venta' ? 'Venta Rápida' : 'Compra Rápida');
  }
  // Socio frecuente: buscar en directorio
  return socios.find(s => s.id_socio === mov.id_socio)?.nombre || 'Socio desvinculado';
}

/* ─── Fila de movimiento ─── */
function MovimientoRow({ mov, socios, variedadesMap, sacosGlobal, onEdit }) {
  const nombreSocio = resolveNombreSocio(mov, socios);
  // Filtro estricto: uuid_movimiento o fallback a id_movimiento
  const sacosDelMov = sacosGlobal.filter(s =>
    (s.uuid_movimiento && s.uuid_movimiento === mov.uuid) ||
    (!s.uuid_movimiento && s.id_movimiento === mov.uuid)
  );

  // Tags de variedad: [Código | Count]
  const varMap = {};
  sacosDelMov.forEach(s => {
    if (!varMap[s.id_variedad]) varMap[s.id_variedad] = 0;
    varMap[s.id_variedad]++;
  });
  const varTags = Object.entries(varMap).map(([id, count]) => ({
    variedad: variedadesMap[id],
    count,
  })).filter(x => x.variedad);

  const totalSacos = sacosDelMov.length;
  const fecha = mov.fecha
    ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : '';
  const esActivo = mov.estado === 'activo';

  return (
    <div
      className="flex items-center space-x-3 px-3 py-3 rounded-2xl transition-all active:scale-[0.98]"
      style={{
        background: esActivo
          ? (mov.es_transbordo === 1
              ? 'rgba(245,158,11,0.07)'
              : (mov.tipo === 'compra' ? 'rgba(37,99,235,0.07)' : 'rgba(5,150,105,0.07)'))
          : 'rgba(255,255,255,0.03)',
        border: esActivo
          ? (mov.es_transbordo === 1
              ? '1px solid rgba(245,158,11,0.2)'
              : (mov.tipo === 'compra' ? '1px solid rgba(37,99,235,0.2)' : '1px solid rgba(5,150,105,0.2)'))
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Icono */}
      <div className={`w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center ${
        mov.es_transbordo === 1
          ? 'bg-amber-600/20'
          : (mov.tipo === 'compra' ? 'bg-blue-600/20' : 'bg-emerald-600/20')
      }`}>
        {mov.es_transbordo === 1
          ? <ArrowLeftRight size={15} className="text-amber-400" />
          : (mov.tipo === 'compra'
              ? <PackagePlus size={15} className="text-blue-400" />
              : <PackageMinus size={15} className="text-emerald-400" />)
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Fila 1: badges + nombre */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <TipoBadge tipo={mov.tipo} esTransbordo={mov.es_transbordo === 1} />
          <EstadoBadge estado={mov.estado} />
          <span className="text-white text-xs font-bold truncate">{nombreSocio}</span>
        </div>
        {/* Fila 2: tags variedad + fecha */}
        <div className="flex items-center flex-wrap gap-1">
          {varTags.map(({ variedad, count }) => (
            <span
              key={variedad.id_variedad}
              className="text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{
                backgroundColor: variedad.color || '#6366f1',
                color: textOnBg(variedad.color || '#6366f1'),
              }}
            >
              {variedad.codigo_corto}
              <span className="opacity-70">·{count}</span>
            </span>
          ))}
          {varTags.length === 0 && (
            <span className="text-slate-700 text-[10px] italic">sin sacos</span>
          )}
          {fecha && <span className="text-slate-600 text-[10px] ml-0.5">{fecha}</span>}
        </div>
        {/* Fila 3: Operator audit badge */}
        <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
          <span>👤 Registrado por: {mov.creado_por_username || 'admin'}</span>
        </div>
      </div>

      {/* Derecha: total sacos + botón editar */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <Layers size={11} className="text-slate-500" />
          <span className="text-white font-black text-sm leading-none">{totalSacos}</span>
          <span className="text-slate-500 text-[10px]">sacos</span>
        </div>
        <button
          onClick={() => onEdit(mov)}
          className="flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95"
          style={{
            color: esActivo
              ? (mov.tipo === 'compra' ? '#60a5fa' : '#34d399')
              : '#64748b',
          }}
        >
          <Edit2 size={9} />
          <span>{esActivo ? 'Reanudar' : 'Editar'}</span>
        </button>
      </div>
    </div>
  );
}

function DatosNegocioModal({ onClose }) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefonos, setTelefonos] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [logo, setLogo] = useState('');

  useEffect(() => {
    const load = async () => {
      const config = await db.ajustes_negocio.get('unico');
      if (config) {
        setNombre(config.nombre || '');
        setDireccion(config.direccion || '');
        setTelefonos(config.telefonos || '');
        setDescripcion(config.descripcion || '');
        setLogo(config.logo || '');
      }
    };
    load();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await db.ajustes_negocio.put({
      id_ajuste: 'unico',
      nombre,
      direccion,
      telefonos,
      descripcion,
      logo
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSave} className="relative w-full max-w-md bg-[#1A2438] rounded-3xl p-6 shadow-2xl border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-white text-base font-black uppercase tracking-wider">Datos del Negocio</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2 border border-white/5 p-3 rounded-2xl bg-white/3">
            <span className="text-slate-400 text-xs font-semibold">Logotipo del Negocio</span>
            {logo ? (
              <img src={logo} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg bg-white/10 p-1" />
            ) : (
              <div className="w-16 h-16 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-slate-600 text-xs">Sin logo</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="negocio-logo-input"
            />
            <label
              htmlFor="negocio-logo-input"
              className="cursor-pointer text-xs bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              Seleccionar Imagen
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Nombre Comercial</label>
            <input
              type="text"
              required
              placeholder='Ej: Almacenes "Flor de Papa"'
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Dirección</label>
            <input
              type="text"
              placeholder="Ej: Av. Las Papas 123"
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Teléfonos de Contacto</label>
            <input
              type="text"
              placeholder="Ej: +51 987654321 / 01-2345678"
              value={telefonos}
              onChange={e => setTelefonos(e.target.value)}
              className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Descripción Comercial</label>
            <textarea
              placeholder="Ej: Compra y venta de papa al por mayor"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold transition-all active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-[0.98]"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── MAIN PAGE ─── */
export default function Inicio() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useUser();
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showNegocioModal, setShowNegocioModal] = useState(false);
  const menuRef = useRef(null);

  // Switch User Modal states
  const [showSwitchUserModal, setShowSwitchUserModal] = useState(false);
  const [selectedUserToSwitch, setSelectedUserToSwitch] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const users = useLiveQuery(() => db.usuarios.filter(u => u.estado === 'Activo').toArray()) || [];

  const handleKeypadPress = (val) => {
    setPinError('');
    if (val === 'delete') {
      setPinInput(p => p.slice(0, -1));
    } else if (val === 'clear') {
      setPinInput('');
    } else {
      if (pinInput.length < 4) {
        const nextPin = pinInput + val;
        setPinInput(nextPin);
        if (nextPin.length === 4) {
          if (selectedUserToSwitch.pin === nextPin) {
            setCurrentUser(selectedUserToSwitch);
            setPinInput('');
            setSelectedUserToSwitch(null);
            setShowSwitchUserModal(false);
          } else {
            setPinError('PIN incorrecto. Inténtelo de nuevo.');
            setPinInput('');
          }
        }
      }
    }
  };

  // Cerrar dropdown al tocar fuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  // Fecha de hoy en formato YYYY-MM-DD usando hora peruana (UTC-5)
  // Usar toISOString() causaba que el día se reiniciara a las 7 PM hora peruana
  // porque toISOString() devuelve UTC. Con Intl.DateTimeFormat usamos la hora local de Lima.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

  // Solo movimientos de hoy — ordenados por fecha_actualizacion desc (último tocado arriba)
  const movimientos = useLiveQuery(() =>
    db.movimientos
      .where('fecha').equals(hoy)
      .sortBy('fecha_actualizacion')
      .then(arr => arr.reverse()) // más recientemente activo arriba
  ) || [];

  const socios     = useLiveQuery(() => db.socios.toArray()) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];
  // Solo sacos de hoy (via movimientos de hoy) — cargamos global y filtramos
  const sacosGlobal = useLiveQuery(() => db.sacos.toArray()) || [];

  const variedadesMap = useMemo(() =>
    Object.fromEntries(variedades.map(v => [v.id_variedad, v])),
    [variedades]
  );

  // UUIDs de movimientos de hoy
  const uuidsHoy = useMemo(() => new Set(movimientos.map(m => m.uuid)), [movimientos]);

  // Sacos de hoy (preasignados a movimientos de hoy)
  const sacosHoy = useMemo(() =>
    sacosGlobal.filter(s => {
      const uid = s.uuid_movimiento || s.id_movimiento;
      return uuidsHoy.has(uid);
    }),
    [sacosGlobal, uuidsHoy]
  );

  const movsFiltrados = useMemo(() => {
    // 1. Solo movimientos con al menos 1 saco (descartar borradores vacíos)
    const sacosCount = {};
    sacosHoy.forEach(s => {
      const uid = s.uuid_movimiento || s.id_movimiento;
      sacosCount[uid] = (sacosCount[uid] || 0) + 1;
    });

    let list = movimientos.filter(m => (sacosCount[m.uuid] || 0) >= 1);

    // 2. Filtro por tipo (tab)
    if (filter !== 'todos') list = list.filter(m => m.tipo === filter);

    // 3. Filtro por búsqueda (nombre de socio)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => {
        const soc = socios.find(s => s.id_socio === m.id_socio);
        return soc?.nombre?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [movimientos, sacosHoy, socios, filter, search]);

  /* ─── Crear nueva operación ─── */
  const nuevaCompra = async () => {
    localStorage.removeItem('compra_activa_uuid');
    const uuid = genUUID();
    const correlativo = await getOcasionalCorrelativo('compra');
    const nombreTemporal = `Compra Rápida (Proveedor ${correlativo})`;
    await db.movimientos.add({
      uuid, tipo: 'compra',
      fecha:     hoy,
      estado:    'activo',
      timestamp: Date.now(),
      fecha_actualizacion: Date.now(),
      id_socio:  SENTINEL_ID,
      socio_nombre_temporal: nombreTemporal,
      modo_transbordo_activo: 0,
      flete_activo: 0,
      flete_precio_kg: 0,
      flete_tipo_signo: 'RESTAR',
      flete_monto_total: 0,
      creado_por_username: currentUser.username,
      id_usuario_operador: currentUser.id_usuario
    });
    localStorage.setItem('compra_activa_uuid', uuid);
    navigate('/compra');
  };

  const nuevaVenta = async () => {
    localStorage.removeItem('venta_activa_uuid');
    const uuid = genUUID();
    const correlativo = await getOcasionalCorrelativo('venta');
    const nombreTemporal = `Venta Rápida (Cliente ${correlativo})`;
    await db.movimientos.add({
      uuid, tipo: 'venta',
      fecha:     hoy,
      estado:    'activo',
      timestamp: Date.now(),
      fecha_actualizacion: Date.now(),
      id_socio:  SENTINEL_ID,
      socio_nombre_temporal: nombreTemporal,
      creado_por_username: currentUser.username,
      id_usuario_operador: currentUser.id_usuario
    });
    localStorage.setItem('venta_activa_uuid', uuid);
    navigate('/venta');
  };

  /* ─── Editar / Reanudar operación ─── */
  const editarMovimiento = async (mov) => {
    await db.movimientos.where('uuid').equals(mov.uuid).modify({ 
      estado: 'activo',
      creado_por_username: currentUser.username,
      id_usuario_operador: currentUser.id_usuario,
      fecha_actualizacion: Date.now()
    });
    if (mov.tipo === 'compra') {
      localStorage.setItem('compra_activa_uuid', mov.uuid);
      navigate('/compra');
    } else {
      localStorage.setItem('venta_activa_uuid', mov.uuid);
      navigate('/venta');
    }
  };

  const TABS = [
    { key: 'todos',  label: 'Todos' },
    { key: 'compra', label: 'Compras' },
    { key: 'venta',  label: 'Ventas' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: '#080E1A', fontFamily: FONT }}>

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-4 pt-5 pb-1"
        style={{ background: 'linear-gradient(180deg,rgba(30,41,59,0.9) 0%,rgba(8,14,26,0) 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white text-lg font-black tracking-tight leading-none">SisgecoMVP</h1>
            <p className="text-slate-500 text-[11px] font-medium mt-0.5">
              Hoy · {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {/* Perfil / Dropdown menú */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center transition-all active:scale-90"
              style={{ background: showMenu ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)', borderColor: showMenu ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)' }}
            >
              <User size={17} className="text-slate-400" />
            </button>

            {/* Dropdown */}
            {showMenu && (
              <div
                className="absolute right-0 top-11 z-50 rounded-2xl overflow-hidden"
                style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', minWidth: 200 }}
              >
                {/* Active user credentials display */}
                <div className="px-4 py-2.5 border-b border-white/5 bg-white/3">
                  <p className="text-white text-xs font-bold truncate">👤 {currentUser.username}</p>
                  <p className="text-indigo-300 text-[8px] font-black uppercase tracking-widest mt-0.5">{currentUser.rol}</p>
                </div>
                
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest px-4 pt-3 pb-1">Configuración</p>
                
                <button
                  onClick={() => { setShowMenu(false); navigate('/socios'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-all active:bg-white/5"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <Users size={14} className="text-indigo-400" />
                  </div>
                  <span className="text-white text-sm font-semibold flex-1 text-left">Socios</span>
                  <ChevronRight size={13} className="text-slate-600" />
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />
                
                <button
                  onClick={() => { setShowMenu(false); navigate('/variedades'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-all active:bg-white/5"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <Leaf size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-white text-sm font-semibold flex-1 text-left">Variedades</span>
                  <ChevronRight size={13} className="text-slate-600" />
                </button>
                
                {currentUser.rol === 'Administrador' && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />
                    <button
                      onClick={() => { setShowMenu(false); setShowNegocioModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all active:bg-white/5"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.15)' }}>
                        <Landmark size={14} className="text-yellow-400" />
                      </div>
                      <span className="text-white text-sm font-semibold flex-1 text-left">Datos del Negocio</span>
                      <ChevronRight size={13} className="text-slate-600" />
                    </button>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />
                    <button
                      onClick={() => { setShowMenu(false); navigate('/admin-usuarios'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all active:bg-white/5"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.15)' }}>
                        <UserCheck size={14} className="text-yellow-400" />
                      </div>
                      <span className="text-white text-sm font-semibold flex-1 text-left">Administrar Usuarios</span>
                      <ChevronRight size={13} className="text-slate-600" />
                    </button>
                  </>
                )}

                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />
                <button
                  onClick={() => { setShowMenu(false); setShowSwitchUserModal(true); setSelectedUserToSwitch(null); setPinInput(''); setPinError(''); }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-all active:bg-white/5"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <ArrowLeftRight size={14} className="text-indigo-400" />
                  </div>
                  <span className="text-white text-sm font-semibold flex-1 text-left">Cambiar de Usuario</span>
                  <ChevronRight size={13} className="text-slate-600" />
                </button>

                <div className="pb-2" />
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input type="text" placeholder="Buscar socio..."
            className="w-full pl-8 pr-8 py-2 text-sm text-white placeholder-slate-600 outline-none rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex space-x-1.5 mb-2">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === tab.key ? '#fff' : 'rgba(255,255,255,0.05)',
                color: filter === tab.key ? '#0F172A' : '#64748B',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTIVITY LIST ── */}
      {/* pb-40 = 64px nav + ~80px botones, para que el último ítem se vea completo */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 min-h-0">
        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-2 mt-1">
          Actividad de Hoy
        </p>

        {movsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Clock size={22} className="text-slate-700" />
            </div>
            <p className="text-slate-600 text-sm font-medium text-center">
              {search ? `Sin resultados para "${search}"` : 'Sin operaciones hoy'}
            </p>
            <p className="text-slate-700 text-xs text-center">Las operaciones aparecen aquí tras el primer pesaje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {movsFiltrados.map(mov => (
              <MovimientoRow
                key={mov.id_movimiento}
                mov={mov}
                socios={socios}
                variedadesMap={variedadesMap}
                sacosGlobal={sacosHoy}
                onEdit={editarMovimiento}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── ACTION BAR FIJA — flota encima del BottomNav ── */}
      <div
        className="fixed bottom-16 left-0 right-0 z-40 px-4 pt-2 pb-3"
        style={{
          background: 'linear-gradient(0deg, rgba(8,14,26,0.98) 70%, rgba(8,14,26,0) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex space-x-3 max-w-lg mx-auto"
          style={{ filter: 'drop-shadow(0 -8px 24px rgba(0,0,0,0.6))' }}>
          <button onClick={nuevaCompra}
            className="flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl bg-blue-600 active:scale-95 transition-all"
            style={{ boxShadow: '0 4px 0 #1d4ed8, 0 8px 24px rgba(37,99,235,0.45)' }}>
            <PackagePlus size={19} className="text-white" />
            <span className="text-white font-black text-base tracking-wide">COMPRAR</span>
          </button>
          <button onClick={nuevaVenta}
            className="flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl bg-emerald-600 active:scale-95 transition-all"
            style={{ boxShadow: '0 4px 0 #047857, 0 8px 24px rgba(16,185,129,0.45)' }}>
            <PackageMinus size={19} className="text-white" />
            <span className="text-white font-black text-base tracking-wide">VENDER</span>
          </button>
        </div>
      </div>
      {showNegocioModal && (
        <DatosNegocioModal onClose={() => setShowNegocioModal(false)} />
      )}
      {showSwitchUserModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setShowSwitchUserModal(false)} />
          <div className="relative w-full max-w-sm bg-[#111A2E] rounded-3xl p-6 shadow-2xl border border-white/5 flex flex-col space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                {selectedUserToSwitch && (
                  <button 
                    onClick={() => { setSelectedUserToSwitch(null); setPinInput(''); setPinError(''); }}
                    className="text-slate-400 hover:text-white transition-colors mr-1"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <h3 className="text-white text-sm font-black uppercase tracking-wider">
                  {selectedUserToSwitch ? 'Ingresar PIN' : 'Cambiar de Usuario'}
                </h3>
              </div>
              <button 
                onClick={() => setShowSwitchUserModal(false)} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {!selectedUserToSwitch ? (
              /* Paso 1: Grid de Usuarios Activos */
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto py-2">
                {users.map(u => {
                  const isAdmin = u.rol === 'Administrador';
                  const initials = u.username.substring(0, 2).toUpperCase();
                  
                  return (
                    <button
                      key={u.id_usuario}
                      onClick={() => { setSelectedUserToSwitch(u); setPinInput(''); setPinError(''); }}
                      className="flex flex-col items-center p-4 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 active:scale-95 transition-all"
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md text-sm mb-2"
                        style={{
                          background: isAdmin 
                            ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' 
                            : 'linear-gradient(135deg, #64748B, #475569)'
                        }}
                      >
                        {initials}
                      </div>
                      <span className="text-slate-200 text-xs font-bold truncate max-w-full">
                        {u.username}
                      </span>
                      <span className="text-slate-500 text-[8px] font-black uppercase tracking-widest mt-0.5">
                        {u.rol}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Paso 2: Teclado Numérico para ingresar PIN */
              <div className="flex flex-col items-center space-y-4 py-2">
                <div className="text-center">
                  <p className="text-slate-400 text-xs font-semibold">Introduzca el PIN de acceso para</p>
                  <p className="text-indigo-400 text-sm font-black mt-0.5">@{selectedUserToSwitch.username}</p>
                </div>

                {/* PIN Dots display */}
                <div className="flex justify-center gap-3 my-2">
                  {[0, 1, 2, 3].map(idx => (
                    <div 
                      key={idx} 
                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                        pinInput.length > idx 
                          ? 'bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/50' 
                          : 'bg-transparent border-white/20'
                      }`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p className="text-rose-400 text-[10px] font-bold text-center">{pinError}</p>
                )}

                {/* Teclado Digital */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num.toString())}
                      className="w-14 h-14 rounded-full bg-white/5 border border-white/5 text-white font-mono text-xl font-bold hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center mx-auto"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('clear')}
                    className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/15 text-rose-400 text-[10px] font-black uppercase hover:bg-rose-500/20 active:scale-90 transition-all flex items-center justify-center mx-auto"
                  >
                    X
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="w-14 h-14 rounded-full bg-white/5 border border-white/5 text-white font-mono text-xl font-bold hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center mx-auto"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('delete')}
                    className="w-14 h-14 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center mx-auto text-xs"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
