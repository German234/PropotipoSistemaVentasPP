/** Módulo utils: redondeo de dinero, validaciones de entrada y respuesta estándar. */
const { redondear2 } = require('../../src/utils/dinero');
const v = require('../../src/utils/validar');
const { AppError, ok, asyncHandler } = require('../../src/utils/respuesta');

describe('utils/dinero · redondear2', () => {
  test.each([
    [1.005, 1.01],
    [2.825, 2.83],
    [1.004, 1],
    [0.1 + 0.2, 0.3],
    [113, 113],
    [-1.005, -1.01],
    [0, 0],
    [0.005, 0.01],
    [0.004, 0],
    // Regresión: residuos de coma flotante en notación exponencial daban NaN (NC 3 de 10 × 1.10 → 500)
    [3.3000000000000003 - 3.3, 0],
    [1e-7, 0],
    [-4.4e-16, 0],
  ])('redondear2(%p) = %p (half-up, sin error de coma flotante)', (entrada, esperado) => {
    expect(redondear2(entrada)).toBe(esperado);
  });
});

describe('utils/validar', () => {
  const esValidacion = (fn, mensaje) => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.codigo).toBe('VALIDACION');
      expect(e.status).toBe(400);
      if (mensaje) expect(e.message).toMatch(mensaje);
      return;
    }
    throw new Error('Se esperaba un error de VALIDACION');
  };

  test('texto recorta y exige contenido y longitud máxima', () => {
    expect(v.texto('  hola  ', 'campo')).toBe('hola');
    esValidacion(() => v.texto('   ', 'nombre'), 'nombre es obligatorio');
    esValidacion(() => v.texto(5, 'nombre'));
    esValidacion(() => v.texto('abcdef', 'nombre', 5), 'máximo 5');
  });

  test('textoOpc convierte vacío en null', () => {
    expect(v.textoOpc('', 'x')).toBeNull();
    expect(v.textoOpc(null, 'x')).toBeNull();
    expect(v.textoOpc(' a ', 'x')).toBe('a');
  });

  test('dinero redondea a 2 decimales y respeta el mínimo', () => {
    expect(v.dinero('1.005', 'precio')).toBe(1.01);
    expect(v.dinero(0, 'precio')).toBe(0);
    esValidacion(() => v.dinero(-1, 'precio'));
    esValidacion(() => v.dinero('abc', 'precio'));
    esValidacion(() => v.dinero('', 'precio'));
    esValidacion(() => v.dinero(null, 'precio'));
  });

  test('entero exige enteros >= min', () => {
    expect(v.entero('3', 'cantidad', 1)).toBe(3);
    esValidacion(() => v.entero(1.5, 'cantidad', 1));
    esValidacion(() => v.entero(0, 'cantidad', 1));
  });

  test('digitos quita guiones/espacios y valida longitudes (NIT 9 o 14, NRC 1–8)', () => {
    expect(v.digitos('0614-230100-123-4', 'nit', [9, 14])).toBe('06142301001234');
    expect(v.digitos('123 456-7', 'nrc', [1, 2, 3, 4, 5, 6, 7, 8])).toBe('1234567');
    esValidacion(() => v.digitos('1234', 'nit', [9, 14]), '9 o 14');
    esValidacion(() => v.digitos('ABC', 'nit', [9, 14]));
  });

  test('id acepta solo enteros positivos', () => {
    expect(v.id('7')).toBe(7);
    esValidacion(() => v.id('0'), 'id inválido');
    esValidacion(() => v.id('x'));
  });
});

describe('utils/respuesta', () => {
  const resFalso = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  test('ok() responde { ok: true, data } con el status indicado', () => {
    const res = resFalso();
    ok(res, { a: 1 }, 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { a: 1 } });
  });

  test('AppError guarda código y status', () => {
    const e = new AppError('STOCK_INSUFICIENTE', 'sin stock', 409);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', status: 409, message: 'sin stock' });
  });

  test('asyncHandler envía al next los errores de un handler async', async () => {
    const error = new Error('falla');
    const next = jest.fn();
    await asyncHandler(async () => { throw error; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
