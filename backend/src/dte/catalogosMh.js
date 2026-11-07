/**
 * Catálogos del MH para la dirección y el documento del receptor (reforma territorial 2024).
 *   CAT-012 Departamento · CAT-013 Municipio (44 municipios nuevos) · Distrito (los 262 municipios anteriores)
 *   CAT-022 Tipo de documento de identificación del receptor
 *
 * Códigos:
 *   - departamento: 01–14.
 *   - municipio: códigos nuevos del CAT-013 (siguen a los antiguos dentro de cada departamento,
 *     p. ej. San Salvador Centro = "23").
 *   - distrito: código del antiguo municipio dentro del departamento (p. ej. San Salvador = "14").
 *   Es la única fuente de estos códigos en el proyecto: si hay que corregir uno, se corrige aquí.
 *
 * Archivo UMD: el backend lo usa con require() y Express lo sirve como /js/catalogos-mh.js
 * (global CATALOGOS_MH) para los mocks del frontend.
 */
(function (root) {
  // [codigo, nombre, distritos en orden de código, [[codMunicipio, nombre, [distritos]]]]
  var DATOS = [
    ['01', 'Ahuachapán',
      ['Ahuachapán', 'Apaneca', 'Atiquizaya', 'Concepción de Ataco', 'El Refugio', 'Guaymango', 'Jujutla',
        'San Francisco Menéndez', 'San Lorenzo', 'San Pedro Puxtla', 'Tacuba', 'Turín'],
      [['13', 'Ahuachapán Norte', ['Atiquizaya', 'El Refugio', 'San Lorenzo', 'Turín']],
        ['14', 'Ahuachapán Centro', ['Ahuachapán', 'Apaneca', 'Concepción de Ataco', 'Tacuba']],
        ['15', 'Ahuachapán Sur', ['Guaymango', 'Jujutla', 'San Francisco Menéndez', 'San Pedro Puxtla']]]],
    ['02', 'Santa Ana',
      ['Candelaria de la Frontera', 'Coatepeque', 'Chalchuapa', 'El Congo', 'El Porvenir', 'Masahuat', 'Metapán',
        'San Antonio Pajonal', 'San Sebastián Salitrillo', 'Santa Ana', 'Santa Rosa Guachipilín',
        'Santiago de la Frontera', 'Texistepeque'],
      [['14', 'Santa Ana Norte', ['Masahuat', 'Metapán', 'Santa Rosa Guachipilín', 'Texistepeque']],
        ['15', 'Santa Ana Centro', ['Santa Ana']],
        ['16', 'Santa Ana Este', ['Coatepeque', 'El Congo']],
        ['17', 'Santa Ana Oeste', ['Candelaria de la Frontera', 'Chalchuapa', 'El Porvenir', 'San Antonio Pajonal',
          'San Sebastián Salitrillo', 'Santiago de la Frontera']]]],
    ['03', 'Sonsonate',
      ['Acajutla', 'Armenia', 'Caluco', 'Cuisnahuat', 'Santa Isabel Ishuatán', 'Izalco', 'Juayúa', 'Nahuizalco',
        'Nahulingo', 'Salcoatitán', 'San Antonio del Monte', 'San Julián', 'Santa Catarina Masahuat',
        'Santo Domingo de Guzmán', 'Sonsonate', 'Sonzacate'],
      [['17', 'Sonsonate Norte', ['Juayúa', 'Nahuizalco', 'Salcoatitán', 'Santa Catarina Masahuat']],
        ['18', 'Sonsonate Centro', ['Nahulingo', 'San Antonio del Monte', 'Santo Domingo de Guzmán', 'Sonsonate', 'Sonzacate']],
        ['19', 'Sonsonate Este', ['Armenia', 'Caluco', 'Cuisnahuat', 'Santa Isabel Ishuatán', 'Izalco', 'San Julián']],
        ['20', 'Sonsonate Oeste', ['Acajutla']]]],
    ['04', 'Chalatenango',
      ['Agua Caliente', 'Arcatao', 'Azacualpa', 'Citalá', 'Comalapa', 'Concepción Quezaltepeque', 'Chalatenango',
        'Dulce Nombre de María', 'El Carrizal', 'El Paraíso', 'La Laguna', 'La Palma', 'La Reina', 'Las Vueltas',
        'Nombre de Jesús', 'Nueva Concepción', 'Nueva Trinidad', 'Ojos de Agua', 'Potonico', 'San Antonio de la Cruz',
        'San Antonio Los Ranchos', 'San Fernando', 'San Francisco Lempa', 'San Francisco Morazán', 'San Ignacio',
        'San Isidro Labrador', 'San José Cancasque', 'San José Las Flores', 'San Luis del Carmen',
        'San Miguel de Mercedes', 'San Rafael', 'Santa Rita', 'Tejutla'],
      [['34', 'Chalatenango Norte', ['Citalá', 'La Palma', 'San Ignacio']],
        ['35', 'Chalatenango Centro', ['Agua Caliente', 'Dulce Nombre de María', 'El Paraíso', 'La Reina',
          'Nueva Concepción', 'San Fernando', 'San Francisco Morazán', 'San Rafael', 'Santa Rita', 'Tejutla']],
        ['36', 'Chalatenango Sur', ['Arcatao', 'Azacualpa', 'Comalapa', 'Concepción Quezaltepeque', 'Chalatenango',
          'El Carrizal', 'La Laguna', 'Las Vueltas', 'Nombre de Jesús', 'Nueva Trinidad', 'Ojos de Agua', 'Potonico',
          'San Antonio de la Cruz', 'San Antonio Los Ranchos', 'San Francisco Lempa', 'San Isidro Labrador',
          'San José Cancasque', 'San José Las Flores', 'San Luis del Carmen', 'San Miguel de Mercedes']]]],
    ['05', 'La Libertad',
      ['Antiguo Cuscatlán', 'Ciudad Arce', 'Colón', 'Comasagua', 'Chiltiupán', 'Huizúcar', 'Jayaque', 'Jicalapa',
        'La Libertad', 'Santa Tecla', 'Nuevo Cuscatlán', 'San Juan Opico', 'Quezaltepeque', 'Sacacoyo',
        'San José Villanueva', 'San Matías', 'San Pablo Tacachico', 'Talnique', 'Tamanique', 'Teotepeque',
        'Tepecoyo', 'Zaragoza'],
      [['23', 'La Libertad Norte', ['Quezaltepeque', 'San Matías', 'San Pablo Tacachico']],
        ['24', 'La Libertad Centro', ['Ciudad Arce', 'San Juan Opico']],
        ['25', 'La Libertad Oeste', ['Colón', 'Jayaque', 'Sacacoyo', 'Talnique', 'Tepecoyo']],
        ['26', 'La Libertad Este', ['Antiguo Cuscatlán', 'Huizúcar', 'Nuevo Cuscatlán', 'San José Villanueva', 'Zaragoza']],
        ['27', 'La Libertad Costa', ['Chiltiupán', 'Jicalapa', 'La Libertad', 'Tamanique', 'Teotepeque']],
        ['28', 'La Libertad Sur', ['Comasagua', 'Santa Tecla']]]],
    ['06', 'San Salvador',
      ['Aguilares', 'Apopa', 'Ayutuxtepeque', 'Cuscatancingo', 'El Paisnal', 'Guazapa', 'Ilopango', 'Mejicanos',
        'Nejapa', 'Panchimalco', 'Rosario de Mora', 'San Marcos', 'San Martín', 'San Salvador',
        'Santiago Texacuangos', 'Santo Tomás', 'Soyapango', 'Tonacatepeque', 'Ciudad Delgado'],
      [['20', 'San Salvador Norte', ['Aguilares', 'El Paisnal', 'Guazapa']],
        ['21', 'San Salvador Oeste', ['Apopa', 'Nejapa']],
        ['22', 'San Salvador Este', ['Ilopango', 'San Martín', 'Soyapango', 'Tonacatepeque']],
        ['23', 'San Salvador Centro', ['Ayutuxtepeque', 'Cuscatancingo', 'Mejicanos', 'San Salvador', 'Ciudad Delgado']],
        ['24', 'San Salvador Sur', ['Panchimalco', 'Rosario de Mora', 'San Marcos', 'Santiago Texacuangos', 'Santo Tomás']]]],
    ['07', 'Cuscatlán',
      ['Candelaria', 'Cojutepeque', 'El Carmen', 'El Rosario', 'Monte San Juan', 'Oratorio de Concepción',
        'San Bartolomé Perulapía', 'San Cristóbal', 'San José Guayabal', 'San Pedro Perulapán', 'San Rafael Cedros',
        'San Ramón', 'Santa Cruz Analquito', 'Santa Cruz Michapa', 'Suchitoto', 'Tenancingo'],
      [['17', 'Cuscatlán Norte', ['Oratorio de Concepción', 'San Bartolomé Perulapía', 'San José Guayabal',
        'San Pedro Perulapán', 'Suchitoto']],
        ['18', 'Cuscatlán Sur', ['Candelaria', 'Cojutepeque', 'El Carmen', 'El Rosario', 'Monte San Juan', 'San Cristóbal',
          'San Rafael Cedros', 'San Ramón', 'Santa Cruz Analquito', 'Santa Cruz Michapa', 'Tenancingo']]]],
    ['08', 'La Paz',
      ['Cuyultitán', 'El Rosario', 'Jerusalén', 'Mercedes La Ceiba', 'Olocuilta', 'Paraíso de Osorio',
        'San Antonio Masahuat', 'San Emigdio', 'San Francisco Chinameca', 'San Juan Nonualco', 'San Juan Talpa',
        'San Juan Tepezontes', 'San Luis Talpa', 'San Miguel Tepezontes', 'San Pedro Masahuat', 'San Pedro Nonualco',
        'San Rafael Obrajuelo', 'Santa María Ostuma', 'Santiago Nonualco', 'Tapalhuaca', 'Zacatecoluca',
        'San Luis La Herradura'],
      [['23', 'La Paz Oeste', ['Cuyultitán', 'Olocuilta', 'San Francisco Chinameca', 'San Juan Talpa', 'San Luis Talpa',
        'San Pedro Masahuat', 'Tapalhuaca']],
        ['24', 'La Paz Centro', ['El Rosario', 'Jerusalén', 'Mercedes La Ceiba', 'Paraíso de Osorio', 'San Antonio Masahuat',
          'San Emigdio', 'San Juan Tepezontes', 'San Miguel Tepezontes', 'San Pedro Nonualco', 'Santa María Ostuma',
          'Santiago Nonualco']],
        ['25', 'La Paz Este', ['San Juan Nonualco', 'San Rafael Obrajuelo', 'Zacatecoluca', 'San Luis La Herradura']]]],
    ['09', 'Cabañas',
      ['Cinquera', 'Dolores', 'Guacotecti', 'Ilobasco', 'Jutiapa', 'San Isidro', 'Sensuntepeque', 'Tejutepeque', 'Victoria'],
      [['10', 'Cabañas Oeste', ['Cinquera', 'Ilobasco', 'Jutiapa', 'Tejutepeque']],
        ['11', 'Cabañas Este', ['Dolores', 'Guacotecti', 'San Isidro', 'Sensuntepeque', 'Victoria']]]],
    ['10', 'San Vicente',
      ['Apastepeque', 'Guadalupe', 'San Cayetano Istepeque', 'San Esteban Catarina', 'San Ildefonso', 'San Lorenzo',
        'San Sebastián', 'San Vicente', 'Santa Clara', 'Santo Domingo', 'Tecoluca', 'Tepetitán', 'Verapaz'],
      [['14', 'San Vicente Norte', ['Apastepeque', 'San Esteban Catarina', 'San Ildefonso', 'San Lorenzo', 'San Sebastián',
        'Santa Clara', 'Santo Domingo']],
        ['15', 'San Vicente Sur', ['Guadalupe', 'San Cayetano Istepeque', 'San Vicente', 'Tecoluca', 'Tepetitán', 'Verapaz']]]],
    ['11', 'Usulután',
      ['Alegría', 'Berlín', 'California', 'Concepción Batres', 'El Triunfo', 'Ereguayquín', 'Estanzuelas', 'Jiquilisco',
        'Jucuapa', 'Jucuarán', 'Mercedes Umaña', 'Nueva Granada', 'Ozatlán', 'Puerto El Triunfo', 'San Agustín',
        'San Buenaventura', 'San Dionisio', 'Santa Elena', 'San Francisco Javier', 'Santa María', 'Santiago de María',
        'Tecapán', 'Usulután'],
      [['24', 'Usulután Norte', ['Alegría', 'Berlín', 'El Triunfo', 'Estanzuelas', 'Jucuapa', 'Mercedes Umaña',
        'Nueva Granada', 'San Buenaventura', 'Santiago de María']],
        ['25', 'Usulután Este', ['California', 'Concepción Batres', 'Ereguayquín', 'Jucuarán', 'Ozatlán', 'San Dionisio',
          'Santa Elena', 'Santa María', 'Tecapán', 'Usulután']],
        ['26', 'Usulután Oeste', ['Jiquilisco', 'Puerto El Triunfo', 'San Agustín', 'San Francisco Javier']]]],
    ['12', 'San Miguel',
      ['Carolina', 'Ciudad Barrios', 'Comacarán', 'Chapeltique', 'Chinameca', 'Chirilagua', 'El Tránsito', 'Lolotique',
        'Moncagua', 'Nueva Guadalupe', 'Nuevo Edén de San Juan', 'Quelepa', 'San Antonio del Mosco', 'San Gerardo',
        'San Jorge', 'San Luis de la Reina', 'San Miguel', 'San Rafael Oriente', 'Sesori', 'Uluazapa'],
      [['21', 'San Miguel Norte', ['Carolina', 'Ciudad Barrios', 'Chapeltique', 'Nuevo Edén de San Juan',
        'San Antonio del Mosco', 'San Gerardo', 'San Luis de la Reina', 'Sesori']],
        ['22', 'San Miguel Centro', ['Comacarán', 'Chirilagua', 'Moncagua', 'Quelepa', 'San Miguel', 'Uluazapa']],
        ['23', 'San Miguel Oeste', ['Chinameca', 'El Tránsito', 'Lolotique', 'Nueva Guadalupe', 'San Jorge', 'San Rafael Oriente']]]],
    ['13', 'Morazán',
      ['Arambala', 'Cacaopera', 'Corinto', 'Chilanga', 'Delicias de Concepción', 'El Divisadero', 'El Rosario',
        'Gualococti', 'Guatajiagua', 'Joateca', 'Jocoaitique', 'Jocoro', 'Lolotiquillo', 'Meanguera', 'Osicala',
        'Perquín', 'San Carlos', 'San Fernando', 'San Francisco Gotera', 'San Isidro', 'San Simón', 'Sensembra',
        'Sociedad', 'Torola', 'Yamabal', 'Yoloaiquín'],
      [['27', 'Morazán Norte', ['Arambala', 'Cacaopera', 'Corinto', 'El Rosario', 'Joateca', 'Jocoaitique', 'Meanguera',
        'Perquín', 'San Fernando', 'San Isidro', 'Torola']],
        ['28', 'Morazán Sur', ['Chilanga', 'Delicias de Concepción', 'El Divisadero', 'Gualococti', 'Guatajiagua', 'Jocoro',
          'Lolotiquillo', 'Osicala', 'San Carlos', 'San Francisco Gotera', 'San Simón', 'Sensembra', 'Sociedad',
          'Yamabal', 'Yoloaiquín']]]],
    ['14', 'La Unión',
      ['Anamorós', 'Bolívar', 'Concepción de Oriente', 'Conchagua', 'El Carmen', 'El Sauce', 'Intipucá', 'La Unión',
        'Lislique', 'Meanguera del Golfo', 'Nueva Esparta', 'Pasaquina', 'Polorós', 'San Alejo', 'San José',
        'Santa Rosa de Lima', 'Yayantique', 'Yucuaiquín'],
      [['19', 'La Unión Norte', ['Anamorós', 'Bolívar', 'Concepción de Oriente', 'El Sauce', 'Lislique', 'Nueva Esparta',
        'Pasaquina', 'Polorós', 'San José', 'Santa Rosa de Lima']],
        ['20', 'La Unión Sur', ['Conchagua', 'El Carmen', 'Intipucá', 'La Unión', 'Meanguera del Golfo', 'San Alejo',
          'Yayantique', 'Yucuaiquín']]]],
  ];

  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  /** [{codigo, nombre, municipios:[{codigo, nombre, distritos:[{codigo, nombre}]}]}] */
  var departamentos = DATOS.map(function (d) {
    var codigoDistrito = {};
    d[2].forEach(function (nombre, i) { codigoDistrito[nombre] = pad2(i + 1); });
    return {
      codigo: d[0],
      nombre: d[1],
      municipios: d[3].map(function (m) {
        return {
          codigo: m[0],
          nombre: m[1],
          distritos: m[2]
            .map(function (nombre) {
              if (!codigoDistrito[nombre]) throw new Error('Distrito sin código: ' + nombre + ' (' + d[1] + ')');
              return { codigo: codigoDistrito[nombre], nombre: nombre };
            })
            .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }),
        };
      }),
    };
  });

  /** CAT-022: tipos de documento del receptor que admite el POS. */
  var tiposDocumento = [
    { codigo: '36', nombre: 'NIT' },
    { codigo: '13', nombre: 'DUI' },
    { codigo: '03', nombre: 'Pasaporte' },
    { codigo: '02', nombre: 'Carnet de residente' },
    { codigo: '37', nombre: 'Otro' },
  ];

  /** Busca códigos → { departamento, municipio, distrito } (objetos del catálogo) o null en lo que no exista. */
  function buscar(dep, mun, dis) {
    var d = departamentos.filter(function (x) { return x.codigo === dep; })[0] || null;
    var m = d && d.municipios.filter(function (x) { return x.codigo === mun; })[0] || null;
    var t = m && m.distritos.filter(function (x) { return x.codigo === dis; })[0] || null;
    return { departamento: d, municipio: m, distrito: t };
  }

  /** "Complemento, Distrito X, Municipio, Departamento" (para mostrar/imprimir). */
  function textoDireccion(dir) {
    if (!dir) return '';
    var b = buscar(dir.departamento, dir.municipio, dir.distrito);
    return [
      dir.complemento,
      b.distrito ? 'Distrito de ' + b.distrito.nombre : null,
      b.municipio ? b.municipio.nombre : null,
      b.departamento ? b.departamento.nombre : null,
    ].filter(Boolean).join(', ');
  }

  var api = { departamentos: departamentos, tiposDocumento: tiposDocumento, buscar: buscar, textoDireccion: textoDireccion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CATALOGOS_MH = api;
})(this);
