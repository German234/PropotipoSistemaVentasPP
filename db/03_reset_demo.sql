/* =========================================================
   03_reset_demo.sql — Deja la BD como recién sembrada para repetir la demo.
   Borra DTE, eventos de invalidación y de contingencia y bitácora; reinicia correlativos (01/03/05 = 0);
   restaura stock/precio/estado de los productos y clientes del seed y elimina los creados después.
   NO toca usuarios ni emisor. Ejecutar con:
     sqlcmd -S localhost -E -C -f 65001 -i db/03_reset_demo.sql
   ========================================================= */
USE BatallonAtlacatl;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM dbo.evento_invalidacion;
DELETE FROM dbo.evento_contingencia_dte;
DELETE FROM dbo.evento_contingencia;
DELETE FROM dbo.dte_detalle;
UPDATE dbo.dte SET dte_relacionado_id = NULL WHERE dte_relacionado_id IS NOT NULL;
DELETE FROM dbo.dte;
DELETE FROM dbo.bitacora;

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

/* clientes: solo los 4 del seed, activos */
DELETE FROM dbo.clientes WHERE nombre NOT IN (N'Juan Pérez', N'María López',
    N'Distribuidora El Roble, S.A. de C.V.', N'Librería Cuscatlán, S.A. de C.V.');
UPDATE dbo.clientes SET activo = 1;

COMMIT TRANSACTION;

/* los ids de DTE vuelven a empezar en 1 (más limpio para la demo) */
DBCC CHECKIDENT ('dbo.dte', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.dte_detalle', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.evento_invalidacion', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.evento_contingencia', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT ('dbo.bitacora', RESEED, 0) WITH NO_INFOMSGS;
GO

PRINT 'Datos de demo reiniciados.';
GO
