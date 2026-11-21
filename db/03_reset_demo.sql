/* =========================================================
   03_reset_demo.sql — Deja la BD como recién sembrada para repetir la demo.
   Borra DTE, eventos de invalidación y de contingencia, bitácora y ejecuciones de tareas programadas;
   la configuración de esas tareas vuelve a la de backend/.env; reinicia correlativos (01/03/05 = 0);
   restaura stock/precio/estado de los productos y clientes del seed y elimina los creados después.
   Fase 6: borra los borradores y deja solo los usuarios del seed (admin/admin123, vendedor/vendedor123) con
   sus datos y contraseñas originales. NO toca el emisor. Ejecutar con:
     sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql
   ========================================================= */
USE BatallonAtlacatl;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM dbo.evento_invalidacion;
DELETE FROM dbo.mh_simulado_dte;
DELETE FROM dbo.evento_contingencia_dte;
DELETE FROM dbo.evento_contingencia;
DELETE FROM dbo.dte_detalle;
UPDATE dbo.dte SET dte_relacionado_id = NULL WHERE dte_relacionado_id IS NOT NULL;
DELETE FROM dbo.dte;
DELETE FROM dbo.bitacora;
/* Fase 5: registro de ejecuciones y configuración de las tareas programadas
   (la configuración vuelve a los valores de backend/.env en el siguiente arranque o consulta) */
IF OBJECT_ID('dbo.ejecucion_tarea', 'U') IS NOT NULL DELETE FROM dbo.ejecucion_tarea;
IF OBJECT_ID('dbo.config_tarea', 'U') IS NOT NULL DELETE FROM dbo.config_tarea;
/* Fase 6: borradores (referencian clientes y usuarios: van antes de limpiar ambos) */
IF OBJECT_ID('dbo.borrador', 'U') IS NOT NULL DELETE FROM dbo.borrador;

UPDATE dbo.correlativos SET ultimo = 0;

/* productos: valores del seed; los que no son del seed se eliminan */
DELETE FROM dbo.productos WHERE codigo NOT IN ('P001','P002','P003','P004','P005','P006','P007','P008','P009','P010');
UPDATE p SET p.descripcion = v.descripcion, p.precio = v.precio, p.stock = v.stock, p.unidad = 59, p.activo = 1
FROM dbo.productos p
JOIN (VALUES
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
) AS v(codigo, descripcion, precio, stock) ON v.codigo = p.codigo;

/* clientes: solo los 4 del seed, con TODOS sus datos como en 02_seed.sql y activos.
   (Desde KAN-34 se editan en la UI: antes el reset solo los reactivaba y un cliente editado o renombrado
   quedaba distinto o desaparecía.) */
DECLARE @seed TABLE (tipo VARCHAR(20), nombre NVARCHAR(250), nombre_comercial NVARCHAR(150), tipo_documento VARCHAR(2),
    num_documento VARCHAR(20), nit VARCHAR(14), nrc VARCHAR(8), cod_actividad VARCHAR(6), desc_actividad NVARCHAR(150),
    direccion NVARCHAR(200), dep VARCHAR(2), mun VARCHAR(2), dis VARCHAR(2), telefono VARCHAR(30), correo NVARCHAR(100));
INSERT INTO @seed VALUES
    ('CONSUMIDOR',    N'Juan Pérez', NULL, '13', '012345678', NULL, NULL, NULL, NULL,
     N'Residencial Las Colinas, casa 4', '05', '26', '01', '77778888', N'juan.perez@correo.com'),
    ('CONSUMIDOR',    N'María López', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     N'Calle Chiltiupán, Ciudad Merliot', '05', '28', '10', NULL, N'maria.lopez@correo.com'),
    ('CONTRIBUYENTE', N'Distribuidora El Roble, S.A. de C.V.', N'El Roble', '36', '06142301001234', '06142301001234', '1234567',
     '46900', N'Venta al por mayor de otros productos',
     N'Colonia Escalón, Paseo General Escalón #3500', '06', '23', '14', '22605000', N'compras@elroble.com.sv'),
    ('CONTRIBUYENTE', N'Librería Cuscatlán, S.A. de C.V.', N'Librería Cuscatlán', '36', '06140512991021', '06140512991021', '2345678',
     '47610', N'Venta al por menor de libros, periódicos y artículos de papelería',
     N'Centro de Gobierno, Edificio B, local 2', '06', '23', '14', '22214400', N'admin@libreriacuscatlan.com.sv');

DELETE FROM dbo.clientes WHERE nombre NOT IN (SELECT nombre FROM @seed);
INSERT INTO dbo.clientes (tipo, nombre, nombre_comercial, tipo_documento, num_documento, nit, nrc, cod_actividad,
                          desc_actividad, direccion, direccion_departamento, direccion_municipio, direccion_distrito, telefono, correo)
SELECT s.tipo, s.nombre, s.nombre_comercial, s.tipo_documento, s.num_documento, s.nit, s.nrc, s.cod_actividad,
       s.desc_actividad, s.direccion, s.dep, s.mun, s.dis, s.telefono, s.correo
FROM @seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.clientes c WHERE c.nombre = s.nombre);
UPDATE c SET c.tipo = s.tipo, c.nombre_comercial = s.nombre_comercial, c.tipo_documento = s.tipo_documento,
             c.num_documento = s.num_documento, c.nit = s.nit, c.nrc = s.nrc, c.cod_actividad = s.cod_actividad,
             c.desc_actividad = s.desc_actividad, c.direccion = s.direccion, c.direccion_departamento = s.dep,
             c.direccion_municipio = s.mun, c.direccion_distrito = s.dis, c.telefono = s.telefono, c.correo = s.correo,
             c.activo = 1
FROM dbo.clientes c JOIN @seed s ON s.nombre = c.nombre;

/* usuarios (Fase 6, desde que se administran en la UI): solo los 2 del seed, activos, con su nombre, rol y
   contraseña originales (mismos hashes que 02_seed.sql). Los creados después se eliminan: ya no tienen DTE,
   eventos, bitácora, borradores ni configuración de tareas que los referencien. */
DECLARE @usr TABLE (usuario NVARCHAR(50), nombre NVARCHAR(150), password_hash NVARCHAR(100), rol NVARCHAR(10));
INSERT INTO @usr VALUES
    ('admin',    N'Administrador',     '$2a$10$2FCV0qffSS9PAQzbxr7byeHn6MK2npuK2l5bB1OcTu1mW5iyFSp6.', 'ADMIN'),
    ('vendedor', N'Vendedor de Turno', '$2a$10$9vKJV9ViZSioUZdva0cmReEK66PWwKxQmF4S7eiBi3iS9gvRYgBXG', 'VENDEDOR');
DELETE FROM dbo.usuarios WHERE usuario NOT IN (SELECT usuario FROM @usr);
INSERT INTO dbo.usuarios (usuario, nombre, password_hash, rol)
SELECT s.usuario, s.nombre, s.password_hash, s.rol FROM @usr s
WHERE NOT EXISTS (SELECT 1 FROM dbo.usuarios u WHERE u.usuario = s.usuario);
UPDATE u SET u.nombre = s.nombre, u.password_hash = s.password_hash, u.rol = s.rol, u.activo = 1
FROM dbo.usuarios u JOIN @usr s ON s.usuario = u.usuario;

COMMIT TRANSACTION;

/* los ids de DTE vuelven a empezar en 1 (más limpio para la demo) */
DBCC CHECKIDENT ('dbo.dte', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.dte_detalle', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.evento_invalidacion', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.evento_contingencia', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.bitacora', RESEED, 0) WITH NO_INFOMSGS;
IF OBJECT_ID('dbo.ejecucion_tarea', 'U') IS NOT NULL DBCC CHECKIDENT ('dbo.ejecucion_tarea', RESEED, 0) WITH NO_INFOMSGS;
GO

PRINT 'Datos de demo reiniciados.';
GO
