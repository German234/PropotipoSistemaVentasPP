/* =========================================================
   02_seed.sql — Datos de prueba. Idempotente.
   Usuarios: admin / admin123 (ADMIN), vendedor / vendedor123 (VENDEDOR)
   Hashes generados con: node db/genHash.js admin123 vendedor123
   ========================================================= */
USE BatallonAtlacatl;
GO
SET NOCOUNT ON;

/* ---------- usuarios ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE usuario = 'admin')
    INSERT INTO dbo.usuarios (usuario, nombre, password_hash, rol)
    VALUES ('admin', N'Administrador', '$2a$10$2FCV0qffSS9PAQzbxr7byeHn6MK2npuK2l5bB1OcTu1mW5iyFSp6.', 'ADMIN');

IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE usuario = 'vendedor')
    INSERT INTO dbo.usuarios (usuario, nombre, password_hash, rol)
    VALUES ('vendedor', N'Vendedor de Turno', '$2a$10$9vKJV9ViZSioUZdva0cmReEK66PWwKxQmF4S7eiBi3iS9gvRYgBXG', 'VENDEDOR');

/* ---------- emisor ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.emisor WHERE id = 1)
    INSERT INTO dbo.emisor (id, nit, nrc, nombre, cod_actividad, desc_actividad, nombre_comercial,
                            tipo_establecimiento, direccion_departamento, direccion_municipio, direccion_complemento,
                            telefono, correo, cod_estable_mh, cod_punto_venta_mh)
    VALUES (1, '06140101001010', '100001', N'Batallón Atlacatl, S.A. de C.V.', '47190',
            N'Venta al por menor en comercios no especializados', N'Tienda Atlacatl',
            '02', '06', '14', N'Calle Principal #1, San Salvador',
            '22220000', N'facturas@atlacatl.com.sv', 'M001', 'P001');

/* ---------- productos (precio SIN IVA) ---------- */
INSERT INTO dbo.productos (codigo, descripcion, precio, stock, unidad)
SELECT v.codigo, v.descripcion, v.precio, v.stock, 59
FROM (VALUES
    ('P001', N'Cuaderno universitario 100 hojas', 2.50, 100),
    ('P002', N'Lapicero azul',                    0.35, 500),
    ('P003', N'Lápiz grafito HB',                 0.25, 400),
    ('P004', N'Resma papel bond carta',           4.75,  60),
    ('P005', N'Folder manila carta',              0.15, 300),
    ('P006', N'Marcador permanente negro',        1.10, 150),
    ('P007', N'Calculadora científica',          18.50,  25),
    ('P008', N'Mochila escolar',                 22.00,  30),
    ('P009', N'Corrector líquido',                1.25, 120),
    ('P010', N'Engrapadora metálica',             6.90,  40)
) AS v(codigo, descripcion, precio, stock)
WHERE NOT EXISTS (SELECT 1 FROM dbo.productos p WHERE p.codigo = v.codigo);

/* ---------- clientes ---------- */
INSERT INTO dbo.clientes (tipo, nombre, nit, nrc, cod_actividad, desc_actividad, direccion, correo)
SELECT v.tipo, v.nombre, v.nit, v.nrc, v.cod_actividad, v.desc_actividad, v.direccion, v.correo
FROM (VALUES
    ('CONSUMIDOR',    N'Juan Pérez',                           NULL,             NULL,      NULL,    NULL,
                      N'Antiguo Cuscatlán, La Libertad',       N'juan.perez@correo.com'),
    ('CONSUMIDOR',    N'María López',                          NULL,             NULL,      NULL,    NULL,
                      N'Santa Tecla, La Libertad',             N'maria.lopez@correo.com'),
    ('CONTRIBUYENTE', N'Distribuidora El Roble, S.A. de C.V.', '06142301001234', '1234567', '46900',
                      N'Venta al por mayor de otros productos',
                      N'Colonia Escalón, San Salvador',        N'compras@elroble.com.sv'),
    ('CONTRIBUYENTE', N'Librería Cuscatlán, S.A. de C.V.',     '06140512991021', '2345678', '47610',
                      N'Venta al por menor de libros, periódicos y artículos de papelería',
                      N'Centro de Gobierno, San Salvador',     N'admin@libreriacuscatlan.com.sv')
) AS v(tipo, nombre, nit, nrc, cod_actividad, desc_actividad, direccion, correo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.clientes c WHERE c.nombre = v.nombre);

/* ---------- correlativos ---------- */
INSERT INTO dbo.correlativos (tipo_dte, ultimo)
SELECT v.tipo_dte, 0
FROM (VALUES ('01'), ('03'), ('05')) AS v(tipo_dte)
WHERE NOT EXISTS (SELECT 1 FROM dbo.correlativos c WHERE c.tipo_dte = v.tipo_dte);
GO
