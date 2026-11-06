/**
 * Validadores ajv de los esquemas oficiales del MH (schemas-mh/).
 *   validar('01', json) → { valido, errores }
 * multipleOfPrecision: el multipleOf: 0.01 estricto falla con decimales en coma flotante.
 */
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const DIR = path.join(__dirname, '..', '..', '..', 'schemas-mh');
const ARCHIVOS = {
  '01': 'fe-f-v2.json',
  '03': 'fe-ccf-v4.json',
  '05': 'fe-nc-v4.json',
  invalidacion: 'invalidacion-schema-v3.json',
  contingencia: 'contingencia-schema-v4.json',
};

const ajv = new Ajv({ allErrors: true, strict: false, multipleOfPrecision: 6 });
addFormats(ajv);

const cache = {};
function validador(tipo) {
  if (!cache[tipo]) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const esquema = require(path.join(DIR, ARCHIVOS[tipo]));
    delete esquema.$schema;
    cache[tipo] = ajv.compile(esquema);
  }
  return cache[tipo];
}

function validar(tipo, json) {
  const fn = validador(tipo);
  const valido = fn(json);
  return { valido, errores: valido ? [] : fn.errors.map((e) => `${e.instancePath} ${e.message}`) };
}

/** Matcher legible: expect(json).toCumplirEsquemaMh('01') */
expect.extend({
  toCumplirEsquemaMh(json, tipo) {
    const { valido, errores } = validar(tipo, json);
    return {
      pass: valido,
      message: () => (valido
        ? `Se esperaba que el JSON NO cumpliera el esquema ${ARCHIVOS[tipo]}`
        : `El JSON no cumple ${ARCHIVOS[tipo]}:\n  ${errores.join('\n  ')}`),
    };
  },
});

module.exports = { validar };
