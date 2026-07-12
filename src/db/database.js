import Dexie from 'dexie';

export const db = new Dexie('SisgecoLocalDB');

/* ─── Versión 1: esquema base ─── */
db.version(1).stores({
  empresas: '++id_empresa, nombre_comercial',
  usuarios: '++id_usuario, id_empresa, username',
  socios: '++id_socio, nombre, es_proveedor, es_cliente',
  variedades: '++id_variedad, nombre, codigo_corto',
  movimientos: '++id_movimiento, uuid, tipo, fecha',
  detalles_grupo: '++id_grupo, id_movimiento, id_variedad',
  sacos: '++id_saco, id_movimiento, id_grupo, peso',
  extras: '++id_extra, id_movimiento, descripcion',
  transacciones_pago: '++id_pago, id_socio, id_movimiento, fecha',
  auditoria: '++id_log, id_usuario, accion, fecha',
});

/* ─── Versión 2: agrega índices para estado, id_socio y timestamp ─── */
db.version(2).stores({
  movimientos: '++id_movimiento, uuid, tipo, fecha, estado, id_socio, timestamp',
}).upgrade(tx => {
  return tx.table('movimientos').toCollection().modify(mov => {
    if (!mov.estado) mov.estado = 'finalizado';
    if (!mov.timestamp) mov.timestamp = Date.now();
  });
});

/* ─── Versión 3: agrega uuid_movimiento como índice en sacos para aislamiento total ─── */
db.version(3).stores({
  sacos: '++id_saco, uuid_movimiento, id_variedad, timestamp',
}).upgrade(tx => {
  return tx.table('sacos').toCollection().modify(saco => {
    if (!saco.uuid_movimiento && saco.id_movimiento) {
      saco.uuid_movimiento = String(saco.id_movimiento);
    }
  });
});

/* ─── Versión 4: agrega id_saco_origen en sacos (trazabilidad transbordo) e índice fecha en movimientos ─── */
db.version(4).stores({
  sacos: '++id_saco, uuid_movimiento, id_variedad, timestamp, id_saco_origen',
  movimientos: '++id_movimiento, uuid, tipo, fecha, estado, id_socio, timestamp, [fecha+tipo]',
});

/* ─── Versión 5: agrega fecha_actualizacion para ordenamiento tipo "último activo primero" ─── */
db.version(5).stores({
  movimientos: '++id_movimiento, uuid, tipo, fecha, estado, id_socio, timestamp, [fecha+tipo], fecha_actualizacion',
}).upgrade(tx =>
  tx.table('movimientos').toCollection().modify(mov => {
    if (!mov.fecha_actualizacion) mov.fecha_actualizacion = mov.timestamp || Date.now();
  })
);

/* ─── Versión 6: agrega es_ocasional a tabla socios ─── */
db.version(6).stores({
  socios: '++id_socio, nombre, es_proveedor, es_cliente, es_ocasional',
}).upgrade(tx => {
  return tx.table('socios').toCollection().modify(socio => {
    if (socio.es_ocasional === undefined) socio.es_ocasional = 0;
  });
});

/* ─── Versión 7: agrega precios_por_variedad en movimientos (JSON blob, sin índice) ─── */
db.version(7).stores({
  movimientos: '++id_movimiento, uuid, tipo, fecha, estado, id_socio, timestamp, [fecha+tipo], fecha_actualizacion',
}).upgrade(tx =>
  tx.table('movimientos').toCollection().modify(mov => {
    if (!mov.precios_por_variedad) mov.precios_por_variedad = {};
  })
);

/* ─── Versión 8: índices en transacciones_pago para consultas de saldo ─── */
db.version(8).stores({
  transacciones_pago: '++id_pago, id_socio, id_movimiento, fecha',
}).upgrade(tx =>
  tx.table('transacciones_pago').toCollection().modify(pago => {
    if (!pago.metodo) pago.metodo = 'efectivo';
    if (!pago.monto) pago.monto = 0;
  })
);

/* ─── Versión 9: Patrón Sentinel Record — Operaciones Ocasionales ───────────────────
   - Agrega socio_nombre_temporal en movimientos (nombre transitorio para SOCIO-OCASIONAL-000)
   - Migra movimientos de socios es_ocasional:1 → id_socio = SENTINEL_ID
   - Elimina socios ocasionales huérfanos de la tabla socios
─────────────────────────────────────────────────────────────────────────────────── */
db.version(9).stores({
  movimientos: '++id_movimiento, uuid, tipo, fecha, estado, id_socio, timestamp, [fecha+tipo], fecha_actualizacion, socio_nombre_temporal',
}).upgrade(async tx => {
  // 1. Obtener todos los socios ocasionales existentes
  const sociosOcasionales = await tx.table('socios')
    .filter(s => s.es_ocasional === 1)
    .toArray();

  const idsSociosOcasionales = new Set(sociosOcasionales.map(s => s.id_socio));
  const nombrePorId = Object.fromEntries(sociosOcasionales.map(s => [s.id_socio, s.nombre]));

  // 2. Reasignar movimientos de ocasionales al centinela, preservando el nombre temporal
  if (idsSociosOcasionales.size > 0) {
    await tx.table('movimientos').toCollection().modify(mov => {
      if (idsSociosOcasionales.has(mov.id_socio)) {
        const nombreOriginal = nombrePorId[mov.id_socio] || '';
        mov.socio_nombre_temporal = nombreOriginal || null;
        mov.id_socio = SENTINEL_ID;
      }
      // Inicializar el campo en movimientos sin nombre temporal
      if (mov.socio_nombre_temporal === undefined) {
        mov.socio_nombre_temporal = null;
      }
    });

    // 3. Eliminar los socios ocasionales de la tabla (ya no son necesarios)
    for (const id of idsSociosOcasionales) {
      await tx.table('socios').delete(id);
    }
  } else {
    // Solo inicializar el campo en todos los movimientos existentes
    await tx.table('movimientos').toCollection().modify(mov => {
      if (mov.socio_nombre_temporal === undefined) {
        mov.socio_nombre_temporal = null;
      }
    });
  }
});

/* ─── Versión 10: agrega ajustes_negocio ─── */
db.version(10).stores({
  ajustes_negocio: 'id_ajuste',
});

/* ─── Versión 11: agrega caja_manual ─── */
db.version(11).stores({
  caja_manual: '++id, tipo, concepto, monto, metodo, fecha, timestamp',
});

/* ─── SENTINEL RECORD ────────────────────────────────────────────────────────────
   ID fijo e inmutable para todas las operaciones ocasionales.
   Usar SENTINEL_ID como clave foránea; el nombre se guarda en
   movimiento.socio_nombre_temporal.
─────────────────────────────────────────────────────────────────────────────────── */
export const SENTINEL_ID = 'SOCIO-OCASIONAL-000';

/**
 * Inserta (o actualiza si ya existe) el registro centinela en la tabla socios.
 * Idempotente: puede llamarse múltiples veces sin efectos secundarios.
 * Llamar desde App.jsx en un useEffect al montar la aplicación.
 */
export const seedSentinelSocio = async () => {
  try {
    const existing = await db.socios.get(SENTINEL_ID);
    if (!existing) {
      await db.socios.put({
        id_socio:    SENTINEL_ID,
        nombre:      'Operación Ocasional',
        es_proveedor: 1,
        es_cliente:   1,
        es_ocasional: 0,      // No es "ocasional" en el sentido antiguo
        es_centinela: 1,      // Flag especial de protección
        saldo_actual: 0,
        documento:   '',
        telefono:    '',
      });
    }
  } catch (err) {
    // Puede fallar si IndexedDB no permite clave string en tabla ++id_socio.
    // En ese caso usamos la tabla de configuración o simplemente ignoramos.
    console.warn('[Sentinel] No se pudo insertar el registro centinela:', err);
  }
};

/**
 * Calcula el correlativo de operaciones ocasionales del día actual (hora peruana).
 * El N en "Cliente [N]" o "Proveedor [N]".
 * Se reinicia a medianoche hora peruana (UTC-5).
 */
export const getOcasionalCorrelativo = async (tipo = 'compra', targetFecha = null) => {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  const fechaQuery = targetFecha || hoy;

  // 1. Limpiar movimientos vacíos inactivos de la fecha seleccionada (para evitar acumular basura)
  const activeUuid = tipo === 'compra'
    ? (localStorage.getItem('compra_activa_uuid') || '')
    : (localStorage.getItem('venta_activa_uuid') || '');
  const activeTbUuid = localStorage.getItem('transbordo_activo_uuid') || '';

  try {
    const movsActivosFecha = await db.movimientos
      .where('fecha').equals(fechaQuery)
      .filter(m => m.tipo === tipo && m.estado === 'activo' && m.uuid !== activeUuid && m.uuid !== activeTbUuid)
      .toArray();

    for (const m of movsActivosFecha) {
      const count = await db.sacos.where('uuid_movimiento').equals(m.uuid).count();
      if (count === 0) {
        await db.movimientos.where('uuid').equals(m.uuid).delete();
        await db.extras.where('id_movimiento').equals(m.uuid).delete();
      }
    }
  } catch (err) {
    console.warn('[Sentinel] Error al limpiar movimientos vacíos:', err);
  }

  // 2. Obtener los movimientos ocasionales de la fecha query (del centinela)
  const movimientosFecha = await db.movimientos
    .where('fecha').equals(fechaQuery)
    .filter(m => m.id_socio === SENTINEL_ID && m.tipo === tipo)
    .toArray();

  if (movimientosFecha.length === 0) return 1;

  // 3. Filtrar solo los que tienen al menos 1 saco en la base de datos
  const uuids = movimientosFecha.map(m => m.uuid);
  const sacosConMov = await db.sacos
    .where('uuid_movimiento').anyOf(uuids)
    .toArray();

  const uuidsConSacos = new Set(sacosConMov.map(s => s.uuid_movimiento));

  return uuidsConSacos.size + 1;
};

/* ─── Helpers ─── */
export const genUUID = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'op-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);

/**
 * Toca el campo fecha_actualizacion del movimiento padre.
 * Llamar después de cada add/update de saco o extra.
 */
export const touchMovimiento = (uuid) =>
  db.movimientos.where('uuid').equals(uuid).modify({ fecha_actualizacion: Date.now() });

/**
 * Resuelve el nombre a mostrar para un movimiento.
 * Si es ocasional, retorna socio_nombre_temporal; si no, busca en socioMap.
 */
export const resolveNombreSocio = (mov, socioMap) => {
  if (mov.id_socio === SENTINEL_ID) {
    return mov.socio_nombre_temporal || 'Operación Rápida';
  }
  return socioMap[mov.id_socio]?.nombre || socioMap[mov.id_socio]?.nombre || '—';
};
