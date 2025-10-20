import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


router.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [usuario] = await poolCibervoluntarios.query(
            'SELECT * FROM `Usuarios` WHERE id_usuario = ?',
            [id]
        );

        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const [resultado] = await poolCibervoluntarios.query(
            'DELETE FROM `Usuarios` WHERE id_usuario = ?',
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(500).json({ error: 'No se pudo eliminar el usuario' });
        }

        res.json({ message: 'Usuario eliminado correctamente' });

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            detalle: error.message
        });
    }
});

router.put('/api/usuarios/:id/:check', async (req, res) => {
  const { id, check } = req.params;

  let nuevoEstado;
  if (check === '1' || check?.toLowerCase?.() === 'true') nuevoEstado = 1;
  else if (check === '0' || check?.toLowerCase?.() === 'false') nuevoEstado = 0;
  else {
    return res.status(400).json({ error: 'Parámetro :check inválido. Usa 0 o 1.' });
  }

  try {
    const [rows] = await poolCibervoluntarios.query(
      'SELECT Activo FROM `Usuarios` WHERE id_usuario = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (Number(rows[0].Activo) === nuevoEstado) {
      return res.status(200).json({
        message: 'Sin cambios: el estado ya era el indicado.',
        id_usuario: id,
        Activo: nuevoEstado
      });
    }

    const [resultado] = await poolCibervoluntarios.query(
      'UPDATE `Usuarios` SET Activo = ? WHERE id_usuario = ?',
      [nuevoEstado, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(500).json({ error: 'No se pudo actualizar el estado del usuario' });
    }

    return res.status(200).json({
      message: 'Estado actualizado correctamente',
      id_usuario: id,
      Activo: nuevoEstado
    });
  } catch (error) {
    console.error('Error actualizando estado de usuario:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message
    });
  }
});


router.put('/api/usuarios/lider/:id/:check', async (req, res) => {
  const { id, check } = req.params;

  // Normaliza y valida el parámetro :check
  let targetRol;
  if (check === '1' || check?.toLowerCase?.() === 'true') targetRol = 3;
  else if (check === '0' || check?.toLowerCase?.() === 'false') targetRol = 4;
  else {
    return res.status(400).json({ error: 'Parámetro :check inválido. Usa 0 o 1.' });
  }

  try {
    const [rows] = await poolCibervoluntarios.query(
      'SELECT id_rol FROM `Usuarios` WHERE id_usuario = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const rolActual = Number(rows[0].id_rol);

    // Solo se permiten usuarios con rol 3 o 4
    if (rolActual !== 3 && rolActual !== 4) {
      return res.status(409).json({
        error: 'No permitido',
        detalle: 'Solo se pueden actualizar usuarios cuyo rol actual sea estudiante o lider.'
      });
    }


    if (rolActual === targetRol) {
      return res.status(200).json({
        message: 'Sin cambios: el rol ya era el indicado.'
      });
    }

    const [resultado] = await poolCibervoluntarios.query(
      'UPDATE `Usuarios` SET id_rol = ? WHERE id_usuario = ?',
      [targetRol, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(500).json({ error: 'No se pudo actualizar el rol del usuario.' });
    }

    return res.status(200).json({
      message: 'Estado actualizado correctamente'
    });
  } catch (error) {
    console.error('Error actualizando id_rol de usuario:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message
    });
  }
});


router.put('/api/usuarios/central/:id/:check', async (req, res) => {
  const { id, check } = req.params;

  // Normaliza y valida el parámetro :check
  let targetRol;
  if (check === '1' || check?.toLowerCase?.() === 'true') targetRol = 1;
  else if (check === '0' || check?.toLowerCase?.() === 'false') targetRol = 2;
  else {
    return res.status(400).json({ error: 'Parámetro :check inválido. Usa 0 o 1.' });
  }

  try {
    const [rows] = await poolCibervoluntarios.query(
      'SELECT id_rol FROM `Usuarios` WHERE id_usuario = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const rolActual = Number(rows[0].id_rol);

    // Solo se permiten usuarios con rol 1 o 2
    if (rolActual !== 1 && rolActual !== 2) {
      return res.status(409).json({
        error: 'No permitido',
        detalle: 'Solo se pueden actualizar usuarios cuyo rol actual sea central (1 o 2).'
      });
    }

    // Si ya tiene el rol objetivo
    if (rolActual === targetRol) {
      return res.status(200).json({
        message: 'Sin cambios: el rol ya era el indicado.',
        id_usuario: id,
        id_rol: rolActual
      });
    }

    // Actualiza el rol
    const [resultado] = await poolCibervoluntarios.query(
      'UPDATE `Usuarios` SET id_rol = ? WHERE id_usuario = ?',
      [targetRol, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(500).json({ error: 'No se pudo actualizar el rol del usuario.' });
    }

    return res.status(200).json({
      message: 'Rol actualizado correctamente',
      id_usuario: id,
      id_rol_anterior: rolActual,
      id_rol_nuevo: targetRol
    });
  } catch (error) {
    console.error('Error actualizando id_rol de usuario:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message
    });
  }
});




// /dashboard/usuarios/administracion
router.get('/administracion', async (req, res) => {
    let sedeFiltrada=1;
    if (req.session.user.rol===1){
      sedeFiltrada = req.query.sede
          ? parseInt(req.query.sede)
          : req.session.user.cod_sede;
    }else{
      sedeFiltrada = req.session.user.cod_sede;
    }

    const querySedes = 'SELECT * FROM Sedes';
    const [resultadoSedes] = await poolDuoc.query(querySedes);

    const [resultadosusuarios] = await poolCibervoluntarios.query('SELECT * FROM `Usuarios` Where cod_sede=?',[sedeFiltrada]);

    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Rol`');

    res.render('pages/private/Admin_Usuarios', {
        Usuarios: resultadosusuarios,
        Sedes: resultadoSedes,
        Roles:rols,
        SedeSeleccionada: sedeFiltrada,
        Usuario: req.session.user
    });
});


// /dashboard/usuarios/subida/masiva
router.get('/carga/masiva', async (req, res) => {
    let sedeFiltrada = req.query.sede
        ? parseInt(req.query.sede)
        : req.session.user.cod_sede;

    const querySedes = 'SELECT * FROM Sedes';
    const [resultadoSedes] = await poolDuoc.query(querySedes);

    const [resultadosusuarios] = await poolCibervoluntarios.query('SELECT * FROM `Usuarios` Where cod_sede=?',[sedeFiltrada]);

    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Rol`');


    if(req.session.user.rol<3){
      res.render('pages/private/Admin_Subida_Masiva', {
        Usuarios: resultadosusuarios,
        Sedes: resultadoSedes,
        Roles:rols,
        SedeSeleccionada: sedeFiltrada,
        Usuario: req.session.user
    });
    }else{
      res.render('pages/private/SinPermisos', {
        Usuario: req.session.user
    });
    }

    
});


// GET /subida/masiva/excel?sede=123
router.get('/descarga/masiva/excel', async (req, res) => {
  // 1) Resolver sede: param ?sede= o cod_sede de sesión
  const sedeFiltrada = req.query.sede
    ? Number.parseInt(req.query.sede, 10)
    : Number(req.session?.user?.cod_sede);

  if (!Number.isInteger(sedeFiltrada)) {
    return res.status(400).json({ error: 'Parámetro "sede" inválido.' });
  }

  try {
    // 2) Traer datos: Usuarios activos de la sede + nombre rol + nombre sede
    // Ajusta los nombres de columnas si difieren (ej.: Sedes.nombre_sede)
    const [rows] = await poolCibervoluntarios.query(
      `
      SELECT
        CONCAT(u.Nombre, ' ', u.Apellido_Paterno, ' ', u.Apellido_Materno) AS nombre_completo,
        u.Correo AS correo,
        u.Celular AS telefono,
        r.Descripcion AS rol,
        u.cod_sede
      FROM Usuarios u
      INNER JOIN Rol r ON r.ID = u.id_rol
      WHERE u.Activo = 1 AND u.cod_sede = ?
      ORDER BY u.id_rol
      `,
      [sedeFiltrada]
    );

    // Obtener nombre legible de la sede desde la BD Duoc
    const [sedes] = await poolDuoc.query(
      `SELECT cod_sede, sede AS nombre_sede FROM Sedes WHERE cod_sede = ?`,
      [sedeFiltrada]
    );

    const nombreSede =
      sedes?.[0]?.nombre_sede ?? `Sede_${String(sedeFiltrada)}`;

    // 3) Construir Excel en memoria
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema Cibervoluntarios';
    wb.created = new Date();

    const ws = wb.addWorksheet('Usuarios Activos');

    // Definir columnas
    ws.columns = [
      { header: 'Nombre',   key: 'nombre',   width: 35 },
      { header: 'Sede',     key: 'sede',     width: 28 },
      { header: 'Correo',   key: 'correo',   width: 35 },
      { header: 'Telefono', key: 'telefono', width: 20 },
      { header: 'Rol',      key: 'rol',      width: 20 },
    ];

    // Estilo para encabezados
    ws.getRow(1).font = { bold: true };

    // Agregar filas
    for (const u of rows) {
      ws.addRow({
        nombre: u.nombre_completo ?? '',
        sede: nombreSede,
        correo: u.correo ?? '',
        telefono: u.telefono ?? '',
        rol: u.rol ?? '',
      });
    }

    // 4) Enviar como descarga
    const fecha = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');

    const filename = `usuarios_activos_${nombreSede.replace(/\s+/g, '_')}_${fecha}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generando Excel:', err);
    res.status(500).json({ error: 'Error generando el Excel.' });
  }
});


export default router;
