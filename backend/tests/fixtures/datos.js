/** Datos fijos para las pruebas unitarias (mismos valores que db/02_seed.sql). */
const emisor = {
  nit: '06140101001010', nrc: '100001', nombre: 'Batallón Atlacatl, S.A. de C.V.',
  codActividad: '47190', descActividad: 'Venta al por menor en comercios no especializados',
  nombreComercial: 'Tienda Atlacatl', tipoEstablecimiento: '02',
  direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Calle Principal #1, San Salvador' },
  telefono: '22220000', correo: 'facturas@atlacatl.com.sv', codEstable: 'M001', codPuntoVenta: 'P001',
};

const producto = (codigo, precio, extra = {}) => ({
  id: Number(codigo.slice(1)), codigo, descripcion: `Producto ${codigo}`, precio, unidad: 59, ...extra,
});

const P001 = producto('P001', 2.5);
const P002 = producto('P002', 0.35);
const P007 = producto('P007', 18.5);

const contribuyente = {
  id: 3, tipo: 'CONTRIBUYENTE', nombre: 'Distribuidora El Roble, S.A. de C.V.', nit: '06142301001234', nrc: '1234567',
  codActividad: '46900', descActividad: 'Venta al por mayor de otros productos',
  nombreComercial: 'El Roble', telefono: '22605000', tipoDocumento: '36', numDocumento: '06142301001234',
  direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Colonia Escalón, Paseo General Escalón #3500' },
  correo: 'compras@elroble.com.sv',
};

const consumidor = {
  id: 1, tipo: 'CONSUMIDOR', nombre: 'Juan Pérez', nit: null, nrc: null, codActividad: null, descActividad: null,
  tipoDocumento: '13', numDocumento: '012345678', telefono: '77778888',
  direccion: { departamento: '05', municipio: '26', distrito: '01', complemento: 'Residencial Las Colinas, casa 4' },
  correo: 'juan.perez@correo.com',
};

/** Cliente anterior a P2: dirección solo texto, sin documento ni códigos MH. */
const consumidorLegado = {
  id: 2, tipo: 'CONSUMIDOR', nombre: 'María López', nit: null, nrc: null, codActividad: null, descActividad: null,
  direccion: 'Santa Tecla, La Libertad', correo: 'maria.lopez@correo.com',
};

const base = (tipo, n = 1) => ({
  numeroControl: `DTE-${tipo}-M001P001-${String(n).padStart(15, '0')}`,
  codigoGeneracion: 'A1B2C3D4-E5F6-4789-AB12-34567890ABCD',
  fecEmi: '2026-11-04',
  horEmi: '15:30:00',
  emisor,
});

module.exports = { emisor, producto, P001, P002, P007, contribuyente, consumidor, consumidorLegado, base };
