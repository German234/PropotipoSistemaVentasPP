/* =========================================================
   01_schema.sql — Esquema del POS académico con DTE simulado
   BD: BatallonAtlacatl (ya creada). Idempotente (IF NOT EXISTS).
   Ejecutar: sqlcmd -S <servidor> -U <usuario> -P <clave> -i db/01_schema.sql
   ========================================================= */
USE BatallonAtlacatl;
GO

/* ---------- usuarios ---------- */
IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
CREATE TABLE dbo.usuarios (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    usuario        NVARCHAR(50)  NOT NULL UNIQUE,
    nombre         NVARCHAR(150) NOT NULL,
    password_hash  NVARCHAR(100) NOT NULL,
    rol            NVARCHAR(10)  NOT NULL CONSTRAINT ck_usuarios_rol CHECK (rol IN ('ADMIN','VENDEDOR')),
    activo         BIT           NOT NULL DEFAULT 1,
    creado_en      DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- emisor (una sola fila, id = 1) ---------- */
IF OBJECT_ID('dbo.emisor', 'U') IS NULL
CREATE TABLE dbo.emisor (
    id                     INT           NOT NULL PRIMARY KEY CONSTRAINT ck_emisor_unico CHECK (id = 1),
    nit                    VARCHAR(14)   NOT NULL,
    nrc                    VARCHAR(8)    NOT NULL,
    nombre                 NVARCHAR(250) NOT NULL,
    cod_actividad          VARCHAR(6)    NOT NULL,
    desc_actividad         NVARCHAR(150) NOT NULL,
    nombre_comercial       NVARCHAR(150) NULL,
    tipo_establecimiento   VARCHAR(2)    NOT NULL,          -- 01 sucursal, 02 casa matriz, ...
    direccion_departamento VARCHAR(2)    NOT NULL,
    direccion_municipio    VARCHAR(2)    NOT NULL,
    direccion_complemento  NVARCHAR(200) NOT NULL,
    telefono               VARCHAR(30)   NOT NULL,
    correo                 NVARCHAR(100) NOT NULL,
    cod_estable_mh         VARCHAR(4)    NOT NULL,          -- p. ej. M001
    cod_punto_venta_mh     VARCHAR(4)    NOT NULL           -- p. ej. P001
);
GO

/* ---------- clientes ---------- */
IF OBJECT_ID('dbo.clientes', 'U') IS NULL
CREATE TABLE dbo.clientes (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    tipo            NVARCHAR(15)  NOT NULL CONSTRAINT ck_clientes_tipo CHECK (tipo IN ('CONSUMIDOR','CONTRIBUYENTE')),
    nombre          NVARCHAR(250) NOT NULL,
    nit             VARCHAR(14)   NULL,
    nrc             VARCHAR(8)    NULL,
    cod_actividad   VARCHAR(6)    NULL,
    desc_actividad  NVARCHAR(150) NULL,
    direccion       NVARCHAR(200) NULL,
    correo          NVARCHAR(100) NULL,
    activo          BIT           NOT NULL DEFAULT 1,
    creado_en       DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT ck_clientes_contribuyente CHECK (
        tipo = 'CONSUMIDOR'
        OR (nit IS NOT NULL AND nrc IS NOT NULL AND cod_actividad IS NOT NULL AND desc_actividad IS NOT NULL)
    )
);
GO

/* ---------- productos (precio SIN IVA) ---------- */
IF OBJECT_ID('dbo.productos', 'U') IS NULL
CREATE TABLE dbo.productos (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    codigo       NVARCHAR(25)  NOT NULL UNIQUE,
    descripcion  NVARCHAR(250) NOT NULL,
    precio       DECIMAL(12,2) NOT NULL CONSTRAINT ck_productos_precio CHECK (precio >= 0),
    stock        INT           NOT NULL DEFAULT 0 CONSTRAINT ck_productos_stock CHECK (stock >= 0),
    unidad       INT           NOT NULL DEFAULT 59,          -- código de unidad de medida MH (59 = unidad)
    activo       BIT           NOT NULL DEFAULT 1,
    creado_en    DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- correlativos (uno por tipo de DTE) ---------- */
IF OBJECT_ID('dbo.correlativos', 'U') IS NULL
CREATE TABLE dbo.correlativos (
    tipo_dte  CHAR(2) NOT NULL PRIMARY KEY,
    ultimo    BIGINT  NOT NULL DEFAULT 0
);
GO

/* ---------- dte ---------- */
IF OBJECT_ID('dbo.dte', 'U') IS NULL
CREATE TABLE dbo.dte (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    tipo_dte             CHAR(2)       NOT NULL CONSTRAINT ck_dte_tipo CHECK (tipo_dte IN ('01','03','05')),
    codigo_generacion    CHAR(36)      NOT NULL CONSTRAINT uq_dte_codigo_generacion UNIQUE,
    numero_control       VARCHAR(31)   NOT NULL CONSTRAINT uq_dte_numero_control UNIQUE,
    cliente_id           INT           NULL REFERENCES dbo.clientes(id),
    usuario_id           INT           NOT NULL REFERENCES dbo.usuarios(id),
    dte_relacionado_id   INT           NULL REFERENCES dbo.dte(id),
    condicion_operacion  TINYINT       NOT NULL DEFAULT 1,
    fecha_emision        DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    subtotal             DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva                  DECIMAL(12,2) NOT NULL DEFAULT 0,
    total                DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado               VARCHAR(12)   NOT NULL DEFAULT 'BORRADOR'
                         CONSTRAINT ck_dte_estado CHECK (estado IN ('BORRADOR','PROCESADO','RECHAZADO','CONTINGENCIA','INVALIDADO')),
    sello_recibido       VARCHAR(40)   NULL,
    json_dte             NVARCHAR(MAX) NULL,
    firma                NVARCHAR(MAX) NULL,
    respuesta_mh         NVARCHAR(MAX) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dte_tipo_estado_fecha')
    CREATE INDEX ix_dte_tipo_estado_fecha ON dbo.dte (tipo_dte, estado, fecha_emision);
GO

/* ---------- dte_detalle ---------- */
IF OBJECT_ID('dbo.dte_detalle', 'U') IS NULL
CREATE TABLE dbo.dte_detalle (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    dte_id           INT           NOT NULL REFERENCES dbo.dte(id),
    num_item         INT           NOT NULL,
    producto_id      INT           NOT NULL REFERENCES dbo.productos(id),
    codigo           NVARCHAR(25)  NOT NULL,                 -- copia al momento de emitir
    descripcion      NVARCHAR(250) NOT NULL,
    cantidad         INT           NOT NULL CONSTRAINT ck_dte_detalle_cantidad CHECK (cantidad > 0),
    unidad           INT           NOT NULL DEFAULT 59,
    precio_unitario  DECIMAL(12,2) NOT NULL,                 -- con IVA en 01, sin IVA en 03/05
    descuento        DECIMAL(12,2) NOT NULL DEFAULT 0,
    venta_gravada    DECIMAL(12,2) NOT NULL,
    iva_item         DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_dte_detalle_item UNIQUE (dte_id, num_item)
);
GO

/* ---------- evento_invalidacion ---------- */
IF OBJECT_ID('dbo.evento_invalidacion', 'U') IS NULL
CREATE TABLE dbo.evento_invalidacion (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    dte_id             INT           NOT NULL REFERENCES dbo.dte(id),
    usuario_id         INT           NOT NULL REFERENCES dbo.usuarios(id),
    codigo_generacion  CHAR(36)      NOT NULL CONSTRAINT uq_evento_codigo_generacion UNIQUE,
    tipo_anulacion     TINYINT       NOT NULL DEFAULT 2,
    motivo             NVARCHAR(250) NOT NULL,
    fecha              DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    json_evento        NVARCHAR(MAX) NOT NULL,
    firma              NVARCHAR(MAX) NULL,
    respuesta_mh       NVARCHAR(MAX) NULL,
    sello_recibido     VARCHAR(40)   NULL
);
GO

/* ---------- evento_contingencia (schemas-mh/contingencia-schema-v4.json) ---------- */
IF OBJECT_ID('dbo.evento_contingencia', 'U') IS NULL
CREATE TABLE dbo.evento_contingencia (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id         INT           NOT NULL REFERENCES dbo.usuarios(id),
    codigo_generacion  CHAR(36)      NOT NULL CONSTRAINT uq_evento_cont_codigo_generacion UNIQUE,
    tipo_contingencia  TINYINT       NOT NULL DEFAULT 1,
    motivo             NVARCHAR(500) NULL,
    f_inicio           DATETIME2(0)  NOT NULL,                  -- emisión del primer DTE del evento
    f_fin              DATETIME2(0)  NOT NULL,                  -- envío del evento
    fecha              DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    estado             VARCHAR(12)   NOT NULL CONSTRAINT ck_evento_cont_estado CHECK (estado IN ('PROCESADO','RECHAZADO')),
    json_evento        NVARCHAR(MAX) NOT NULL,
    firma              NVARCHAR(MAX) NULL,
    respuesta_mh       NVARCHAR(MAX) NULL,
    sello_recibido     VARCHAR(40)   NULL
);
GO
/* C2: origen del lote (manual o cierre del día automático) y recepción por lote de los DTE */
IF COL_LENGTH('dbo.evento_contingencia', 'origen') IS NULL
    ALTER TABLE dbo.evento_contingencia ADD origen VARCHAR(10) NOT NULL
        CONSTRAINT df_evento_cont_origen DEFAULT 'MANUAL'
        CONSTRAINT ck_evento_cont_origen CHECK (origen IN ('MANUAL','AUTOMATICO'));
GO
IF COL_LENGTH('dbo.evento_contingencia', 'codigo_lote') IS NULL
    ALTER TABLE dbo.evento_contingencia ADD codigo_lote CHAR(36) NULL, respuesta_lote NVARCHAR(MAX) NULL;
GO

/* C3: seguimiento de la cola de consultas a MH (DTE en CONTINGENCIA) */
IF COL_LENGTH('dbo.dte', 'consultas_mh') IS NULL
    ALTER TABLE dbo.dte ADD consultas_mh INT NOT NULL CONSTRAINT df_dte_consultas_mh DEFAULT 0,
                            ultima_consulta_mh DATETIME2(3) NULL,     -- ms: ordena la cola round-robin
                            resultado_consulta_mh VARCHAR(15) NULL;   -- ENCONTRADO | NO_ENCONTRADO | SIN_RESPUESTA
GO

/* P2: datos completos del receptor con los catálogos MH (backend/src/dte/catalogosMh.js).
   clientes.direccion pasa a ser el complemento; departamento/municipio/distrito son códigos MH. */
IF COL_LENGTH('dbo.clientes', 'direccion_departamento') IS NULL
    ALTER TABLE dbo.clientes ADD tipo_documento         VARCHAR(2)    NULL,   -- CAT-022 (36 NIT, 13 DUI, ...)
                                 num_documento          VARCHAR(20)   NULL,
                                 nombre_comercial       NVARCHAR(150) NULL,
                                 telefono               VARCHAR(30)   NULL,
                                 direccion_departamento VARCHAR(2)    NULL,   -- CAT-012
                                 direccion_municipio    VARCHAR(2)    NULL,   -- CAT-013
                                 direccion_distrito     VARCHAR(2)    NULL;
GO
IF COL_LENGTH('dbo.emisor', 'direccion_distrito') IS NULL
    ALTER TABLE dbo.emisor ADD direccion_distrito VARCHAR(2) NULL;
GO

/* ---------- mh_simulado_dte (C3): lo que el MH simulado "recibió" aunque su respuesta no llegara (X-Simular: timeout).
   Es el lado de Hacienda: la consulta de DTE y los reenvíos lo leen. No es parte del POS real. ---------- */
IF OBJECT_ID('dbo.mh_simulado_dte', 'U') IS NULL
CREATE TABLE dbo.mh_simulado_dte (
    codigo_generacion  CHAR(36)      NOT NULL PRIMARY KEY,
    tipo_dte           CHAR(2)       NOT NULL,
    json_dte           NVARCHAR(MAX) NOT NULL,                  -- el JSON que MH recibió (modelo previo)
    firma              NVARCHAR(MAX) NOT NULL,
    respuesta_mh       NVARCHAR(MAX) NOT NULL,                  -- respuesta PROCESADO que nunca llegó al POS
    sello_recibido     VARCHAR(40)   NOT NULL,
    fecha              DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
GO

/* ---------- evento_contingencia_dte: DTE incluidos en cada evento (detalleDTE) ---------- */
IF OBJECT_ID('dbo.evento_contingencia_dte', 'U') IS NULL
CREATE TABLE dbo.evento_contingencia_dte (
    evento_id  INT NOT NULL REFERENCES dbo.evento_contingencia(id),
    dte_id     INT NOT NULL REFERENCES dbo.dte(id),
    no_item    INT NOT NULL,
    CONSTRAINT pk_evento_contingencia_dte PRIMARY KEY (evento_id, dte_id)
);
GO

/* ---------- bitacora ---------- */
IF OBJECT_ID('dbo.bitacora', 'U') IS NULL
CREATE TABLE dbo.bitacora (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id  INT           NULL REFERENCES dbo.usuarios(id),
    accion      VARCHAR(30)   NOT NULL,                     -- LOGIN, EMISION, REINTENTO, INVALIDACION, ...
    entidad     VARCHAR(30)   NULL,                         -- dte, producto, cliente, ...
    entidad_id  INT           NULL,
    detalle     NVARCHAR(MAX) NULL,
    fecha       DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bitacora_fecha')
    CREATE INDEX ix_bitacora_fecha ON dbo.bitacora (fecha DESC);
GO
