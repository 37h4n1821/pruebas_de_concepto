import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from "exceljs";




const router = Router();

function checkRole() {
    return (req, res, next) => {
        if (!req.session.user || ![2, 3, 1].includes(req.session.user.rol)) {
          res.render('pages/private/SinPermisos', {
        Usuario: req.session.user
    });
        }
        next();
    };
}
// /dashboard/eventos/administracion
router.get('/administracion',checkRole(), async (req, res) => {
  const rolDelUsuario = req.session.user.rol;  // usuario admin


  
  let sedeFiltrada = req.session.user.cod_sede;

  let resultado;
  let resultadoSedes;


    if (![2, 3, 1].includes(req.session.user.rol)) {
        return res.redirect('/dashboard');
    }


  if (req.session.user.rol !== 1) {
    // usuario normal: solo su sede fija
     
    const query = 'SELECT * FROM Eventos_Vista WHERE Id_Sede = ? ORDER BY Fecha_Creacion DESC';
    [resultado] = await poolCibervoluntarios.query(query, [sedeFiltrada]);
    const querySedes = 'SELECT * FROM Sedes WHERE cod_sede = ?';
    [resultadoSedes] = await poolDuoc.query(querySedes, [sedeFiltrada]);
  } else {
    
     const query = 'SELECT * FROM Eventos_Vista ORDER BY Fecha_Creacion DESC';
      [resultado] = await poolCibervoluntarios.query(query);
      const querySedes = 'SELECT * FROM Sedes';
      [resultadoSedes] = await poolDuoc.query(querySedes);
  }

  const queryOrigen = 'SELECT * FROM Eventos_Origen'
  const [resultadoOrigen] = await poolDuoc.query(queryOrigen)

  const queryCarreras = 'SELECT ID AS id, carrera AS nombre FROM Carreras_Sedes_Vista'
  const [resultadoCarreras] = await poolDuoc.query(queryCarreras)



  const queryVCMAmbito = 'SELECT * FROM VCM_Ambito_Accion'
  const [resultadoVCMAmbito] = await poolDuoc.query(queryVCMAmbito)

  const queryVCMEntidad = 'SELECT * FROM VCM_Entidad_Relacionada'
  const [resultadoVCMEntidad] = await poolDuoc.query(queryVCMEntidad)

  const queryVCMObjetivo = 'SELECT * FROM VCM_Objetivo'
  const [resultadoVCMObjetivo] = await poolDuoc.query(queryVCMObjetivo)

  const queryVCMPrincipio = 'SELECT * FROM VCM_Principio_Politica'
  const [resultadoVCMPrincipio] = await poolDuoc.query(queryVCMPrincipio)

  const queryVCMTipoActividad = 'SELECT * FROM VCM_Tipo_Actividad'
  const [resultadoVCMTipoActividad] = await poolDuoc.query(queryVCMTipoActividad)

  const queryEstatus = 'SELECT * FROM Evento_Estatus'
  const [resultadoEstatus] = await poolDuoc.query(queryEstatus)

  const queryTipoPublico = 'SELECT * FROM Tipo_Publico'
  const [resultadoTipoPublico] = await poolCibervoluntarios.query(queryTipoPublico)

  const queryDetalle_Publico = 'SELECT * FROM Detalle_Publico'
  const [resultadoDetalle_Publico] = await poolCibervoluntarios.query(queryDetalle_Publico)

  const queryAnios = 'SELECT DISTINCT Anio FROM ( SELECT YEAR(Fecha_inicio) AS Anio FROM Eventos UNION SELECT YEAR(Fecha_termino) AS Anio FROM Eventos ) AS Anios ORDER BY Anio;'
  const [resultadoAnios] = await poolCibervoluntarios.query(queryAnios)


  // Construir estructura a partir de lo que viene de la BD
  const categoriasPublico = {};

  // 1. Inicializa categorías (interno, externo, mixto)
  resultadoTipoPublico.forEach(tipo => {
    categoriasPublico[tipo.Tipo.toLowerCase()] = [];
  });

  // 2. Mete los detalles en la categoría correcta
  resultadoDetalle_Publico.forEach(detalle => {
    const tipo = resultadoTipoPublico.find(t => t.ID === detalle.ID_Tipo);
    if (tipo) {
      categoriasPublico[tipo.Tipo.toLowerCase()].push({
        id: detalle.ID,
        nombre: detalle.Nombre,
        id_tipo: tipo.ID
      });
    }
  });

 categoriasPublico['mixto'] = [
  ...categoriasPublico['interno'].map(c => ({ ...c, id_tipo: 3 })),
  ...categoriasPublico['externo'].map(c => ({ ...c, id_tipo: 3 }))
];

  res.render('pages/private/Admin_Eventos', {
    datos: resultado,
    rolUsuario: rolDelUsuario,   // para controlar permisos
    sedeFiltrada: sedeFiltrada,    // para mostrar cuál sede se filtra
    datosSedes: resultadoSedes,
    datosOrigen: resultadoOrigen,
    datosCarreras: resultadoCarreras,
    datosVCMAmbito: resultadoVCMAmbito,
    datosVCMEntidad: resultadoVCMEntidad,
    datosVCMObjetivo: resultadoVCMObjetivo,
    datosVCMPrincipio: resultadoVCMPrincipio,
    datosVCMTipoActividad: resultadoVCMTipoActividad,
    datosEstatus: resultadoEstatus,
    datosPublico: resultadoTipoPublico,
    datosAnios: resultadoAnios,
    categoriasPublico,
    Usuario: req.session.user
  });
});





function generarCodigo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 4; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}


async function codigoUnico(pool) {
  let codigo;
  let existe = true;

  while (existe) {
    codigo = generarCodigo();
    const [rows] = await pool.query('SELECT 1 FROM Eventos WHERE code = ? LIMIT 1', [codigo]);
    existe = rows.length > 0;
  }

  return codigo;
}



router.post('/api/eventos',checkRole(), async (req, res) => {
    if (!req.session.user || ![2, 3, 1].includes(req.session.user.rol)) {
        return res.status(403).send("Acceso denegado");
    }
  try {
    const {
      nombre_actividad,
      responsable,
      rol_organizador,
      descripcion,
      origen_actividad,
      categoria,
      intersede,
      sede_organizadora,
      carreras_participantes,
      fecha_inicio,
      fecha_termino,
      publico_interno,
      publico_externo,
      ID_Tipo_Publico,
      IDs_Detalle_Publico,
      capacidad,
      tipo_actividad_vcm,
      entidad_relacionada_vcm,
      principios_politica_vcm,
      objetivo_vcm,
      ambito_accion_vcm,
      gasto_proyectado,
      estatus,
      aplico_encuesta,
      link_encuesta,
      link_evidencia,
      ubicacion,
      color_hex
    } = req.body;

    // Convertir carreras a JSON string para guardarlas
    const carrerasJSON = JSON.stringify(carreras_participantes);
    const detallesJSON = JSON.stringify(IDs_Detalle_Publico);

    const codigo = await codigoUnico(poolCibervoluntarios);


    await poolCibervoluntarios.query(
      `INSERT INTO Eventos (
        Nombre_actividad,
        Descripcion_actividad,
        Origen_actividad,
        Responsable,
        Carreras_participantes,
        Fecha_inicio,
        Fecha_termino,
        Publico_interno_proyectado,
        Publico_externo_proyectado,
        ID_Tipo_Publico,
        IDs_Detalle_Publico,
        Gasto,
        Tipo_actividad_VCM,
        Entidad_relacionada_VCM,
        Principios_politica_aborda_VCM,
        Objetivo_VCM,
        Ambito_accion_actividad_VCM,
        Estatus,
        APLICO_ENCUESTA,
        Link_Encuesta,
        sede_organizadora,
        Registro_Activo,
        Categoria,
        Link_Evidencia,
        ubicacion,
        code,
        Intersede,
        Rol_Organizacion,
        ColorHex
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?,?)`,
      [
        nombre_actividad,
        descripcion || null,
        parseInt(origen_actividad),
        responsable,
        carrerasJSON,
        fecha_inicio,
        fecha_termino,
        parseInt(publico_interno) || 0,
        parseInt(publico_externo) || 0,
        parseInt(ID_Tipo_Publico),
        detallesJSON,
        parseInt(gasto_proyectado),
        tipo_actividad_vcm || null,
        entidad_relacionada_vcm || null,
        principios_politica_vcm || null,
        objetivo_vcm || null,
        ambito_accion_vcm || null,
        parseInt(estatus),
        parseInt(aplico_encuesta),
        link_encuesta || null,
        parseInt(sede_organizadora),
        1,
        categoria || 'Evento',
        link_evidencia || null,
        ubicacion,
        codigo,
        parseInt(intersede),
        parseInt(rol_organizador),
        color_hex
      ]
    );

    res.json({ message: 'Evento creado exitosamente' });
  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).json({ error: 'Error interno al crear el evento' });
  }
});


// Obtener un evento por ID
router.get('/api/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await poolCibervoluntarios.query(
      `SELECT * FROM Eventos_Vista WHERE Id = ? `,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener evento:', error);
    res.status(500).json({ error: 'Error interno al obtener evento' });
  }
});

router.get('/api/sede/:codSede', async (req, res) => {
  const codSede = parseInt(req.params.codSede);
  try {
    // Obtener carreras por sede
    const [carreras] = await poolDuoc.query(
      'SELECT ID AS id, carrera AS nombre FROM Carreras_Sedes_Vista',
    );

    const [responsables] = await poolCibervoluntarios.query(
      'SELECT id_usuario AS id, CONCAT(Nombre, " ", Apellido_Paterno, " ", Apellido_Materno) AS nombre FROM Usuarios WHERE cod_sede = ? AND id_rol = 1 OR id_rol = 2',
      [codSede]
    );

    res.json({ responsables, carreras });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos de la sede' });
  }
});


router.delete('/api/eventos/:id', checkRole(), async (req, res) => {
  const idEvento = parseInt(req.params.id);
  if (isNaN(idEvento)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

   if (!req.session.user || ![2, 1].includes(req.session.user.rol)) {
        return res.status(403).send("Acceso denegado");
    }

  try {
    const [result] = await poolCibervoluntarios.query('DELETE FROM Eventos WHERE id = ?', [idEvento]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json({ message: 'Evento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando evento:', error);
    res.status(500).json({ error: 'Error interno al eliminar evento' });
  }
});



router.get("/export-excel-inscritos/:id", checkRole(), async (req, res) => {
  const eventoId = req.params.id; // ID del evento
  const eventoNombre = req.query.nombre || `evento_${eventoId}`; // nombre desde query, fallback

  try {
    const [rows] = await poolCibervoluntarios.query(`
            SELECT Nombre, Correo, Tipo, Afiliación, Sede, Carrera, Jornada 
            FROM Participantes_Eventos_Vista 
            WHERE ID_Evento = ? 
        `, [eventoId]);

    if (rows.length === 0) {
      return res.status(404).send("Evento no encontrado");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inscritos");

    worksheet.columns = Object.keys(rows[0]).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 20
    }));

    rows.forEach(row => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    // Usar nombre del evento en el filename
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inscritos_${eventoNombre}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando el Excel de inscritos");
  }
});


router.get("/export-excel-asistentes/:id",checkRole(), async (req, res) => {
  const eventoId = req.params.id; // ID del evento
  const eventoNombre = req.query.nombre || `evento_${eventoId}`; // nombre desde query, fallback

  try {
    const [rows] = await poolCibervoluntarios.query(`
            SELECT Nombre, Correo, Tipo, Afiliación, Sede, Carrera, Jornada 
            FROM Participantes_Eventos_Vista 
            WHERE ID_Evento = ? AND Asistio = 1
        `, [eventoId]);

    if (rows.length === 0) {
      return res.status(404).send("Evento no encontrado");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Asistentes");

    worksheet.columns = Object.keys(rows[0]).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 20
    }));

    rows.forEach(row => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    // Usar nombre del evento en el filename
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=asistentes_${eventoNombre}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando el Excel de asistentes");
  }
});


router.get("/export-excel-filtrados", checkRole(), async (req, res) => {
  const ids = req.query.ids?.split(",").map(id => parseInt(id)).filter(Boolean);

  if (!ids || ids.length === 0) {
    return res.status(400).send("No se enviaron IDs de eventos");
  }

  try {
    const [rows] = await poolCibervoluntarios.query(`
      SELECT Nombre, Descripcion, Origen, Categoria, Nombre_Responsable, Correo_Responsable,
             carreras_nombres, Sede_Organizadora, Publico_Interno_Proyectado, Publico_Externo_Proyectado,
             Capacidad, Fecha_Inicio, Hora_Inicio, Fecha_Termino, Hora_Termino,
             Inscritos, Asistentes, Gasto, Tipo_Actividad_VCM_Detalle, Entidad_Relacionada_VCM_Detalle,
             Principios_Politica_Aborda_VCM_Detalle, Objetivo_VCM_Detalle, Ambito_Accion_Actividad_VCM_Detalle,
             Estatus, Link_Encuesta, Link_Evidencia, Ubicacion, Intersede, Rol AS Rol_Institucion
      FROM Eventos_Vista 
      WHERE id IN (?)
    `, [ids]);

    if (rows.length === 0) {
      return res.status(404).send("No hay eventos seleccionados");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Eventos");

    worksheet.columns = Object.keys(rows[0]).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 20
    }));

    rows.forEach(row => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=eventos_filtrados.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando el Excel de eventos");
  }
});





// Actualizar evento por ID
router.put('/api/eventos/:id', checkRole(),async (req, res) => {

  if (!req.session.user || ![2, 1].includes(req.session.user.rol)) {
        return res.status(403).send("Acceso denegado");
    }
  try {

    const {
      idEventoEditar,
      nombre_actividadEditar,
      rol_organizadorEditar,
      descripcionEditar,
      origen_actividadEditar,
      categoriaEditar,
      intersedeEditar,
      fecha_inicioEditar,
      fecha_terminoEditar,
      publico_internoEditar,
      publico_externoEditar,
      tipo_publicoEditar,
      detalleTipoPublicoEditar,
      capacidadEditar,
      tipo_actividad_vcmEditar,
      entidad_relacionada_vcmEditar,
      principios_politica_vcmEditar,
      objetivo_vcmEditar,
      ambito_accion_vcmEditar,
      gasto_proyectadoEditar,
      estatusEditar,
      aplico_encuestaEditar,
      link_encuestaEditar,
      link_evidenciaEditar,
      ubicacionEditar
    } = req.body;

    const detallesJSON = JSON.stringify(detalleTipoPublicoEditar);

    await poolCibervoluntarios.query(
      `UPDATE Eventos SET
        Nombre_actividad = ?,
        Descripcion_actividad = ?,
        Origen_actividad = ?,
        Fecha_inicio = ?,
        Fecha_termino = ?,
        Publico_interno_proyectado = ?,
        Publico_externo_proyectado = ?,
        ID_Tipo_Publico = ?,
        IDs_Detalle_Publico = ?,
        Gasto = ?,
        Tipo_actividad_VCM = ?,
        Entidad_relacionada_VCM = ?,
        Principios_politica_aborda_VCM = ?,
        Objetivo_VCM = ?,
        Ambito_accion_actividad_VCM = ?,
        Estatus = ?,
        APLICO_ENCUESTA = ?,
        Link_Encuesta = ?,
        Categoria = ?,
        Link_Evidencia = ?,
        ubicacion = ?,
        Intersede = ?,
        Rol_Organizacion = ?
      WHERE Id = ?`,
      [
        nombre_actividadEditar,
        descripcionEditar || null,
        parseInt(origen_actividadEditar),
        fecha_inicioEditar,
        fecha_terminoEditar,
        parseInt(publico_internoEditar) || 0,
        parseInt(publico_externoEditar) || 0,
        parseInt(tipo_publicoEditar),
        detallesJSON,
        parseInt(gasto_proyectadoEditar),
        tipo_actividad_vcmEditar || null,
        entidad_relacionada_vcmEditar || null,
        principios_politica_vcmEditar || null,
        objetivo_vcmEditar || null,
        ambito_accion_vcmEditar || null,
        parseInt(estatusEditar),
        parseInt(aplico_encuestaEditar),
        link_encuestaEditar || null,
        categoriaEditar || 'Evento',
        link_evidenciaEditar || null,
        ubicacionEditar,
        parseInt(intersedeEditar),
        parseInt(rol_organizadorEditar),
        parseInt(idEventoEditar)
      ]
    );

    res.json({ message: 'Evento actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar evento:', error);
    res.status(500).json({ error: 'Error interno al actualizar evento' });
  }
});




export default router;
