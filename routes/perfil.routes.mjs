import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


const PHONE_REGEX = /^\+[0-9]{5,15}$/; // + y 5-15 dígitos
const NAME_REGEX = /^[A-Za-zÁ-ÿ'´`^~.\- ]{2,60}$/u;
const PASS_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/;

function getSessionUserId(req) {
  return (
    req.session?.user?.ID ||
    req.session?.user?.id_usuario ||
    null
  );
}

function sanitizeName(s) {
  return String(s ?? '').trim();
}

function normalizePhone(p) {
  return String(p ?? '').trim();
}

// /dashboard/perfil/
router.get('/', async (req, res) => {
    const querySedes = 'SELECT * FROM Sedes';
    const [resultadoSedes] = await poolDuoc.query(querySedes);

    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Rol`');

    res.render('pages/private/Admin_perfil', {
        Usuario: req.session.user,
        Sedes: resultadoSedes
    });
});
// /dashboard/perfil/credencial
router.get('/credencial', async (req, res) => {

  const querySedes = 'SELECT * FROM Sedes';
    const [resultadoSedes] = await poolDuoc.query(querySedes);
    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Rol`');

    res.render('pages/private/Admin_perfil_credencial', {
        Usuario: req.session.user,
         Sedes: resultadoSedes
    });
});




// =========================
// 1) Actualizar datos de perfil
// =========================
// PUT /dashboard/perfil/datos
router.put('/datos', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }

    const { Nombre, ApellidoP, ApellidoM, Telefono } = req.body;

    const nombre = sanitizeName(Nombre);
    const apP = sanitizeName(ApellidoP);
    const apM = sanitizeName(ApellidoM);
    const cel = normalizePhone(Telefono);

    // Validaciones básicas
    if (!nombre || !apP || !apM || !cel) {
      return res.status(400).json({
        ok: false,
        message: 'Todos los campos son obligatorios.',
      });
    }

    if (!NAME_REGEX.test(nombre) || !NAME_REGEX.test(apP) || !NAME_REGEX.test(apM)) {
      return res.status(400).json({
        ok: false,
        message:
          'Nombre y apellidos solo pueden contener letras, espacios y algunos signos (mín. 2, máx. 60).',
      });
    }

    if (!PHONE_REGEX.test(cel)) {
      return res.status(400).json({
        ok: false,
        message:
          'El celular debe estar en formato internacional, ej: +56912345678.',
      });
    }

    // Verifica que el celular no exista en otro usuario
    const [dup] = await poolCibervoluntarios.query(
      'SELECT id_usuario FROM Usuarios WHERE Celular=? AND id_usuario<>?',
      [cel, userId]
    );
    if (dup.length > 0) {
      return res.status(409).json({
        ok: false,
        message:
          'El número de celular ya está registrado en otra cuenta.',
      });
    }

    // Actualiza
    const [r] = await poolCibervoluntarios.query(
      `UPDATE Usuarios
       SET Nombre=?, Apellido_Paterno=?, Apellido_Materno=?, Celular=?
       WHERE id_usuario=?`,
      [nombre, apP, apM, cel, userId]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    // Actualiza la sesión para que la vista refleje los cambios
    req.session.user = {
      ...req.session.user,
      Nombre: nombre,
      Apellido_P: apP,       // tus vistas usan Apellido_P y Apellido_M
      Apellido_M: apM,
      Celular: cel,
    };

    return res.json({ ok: true, message: 'Datos actualizados correctamente.' });
  } catch (err) {
    console.error('PUT /perfil/datos error:', err);
    return res.status(500).json({
      ok: false,
      message:
        'Error en el servidor al actualizar los datos. Intenta más tarde.',
    });
  }
});

// =========================
// 2) Cambiar contraseña
// =========================
// PUT /dashboard/perfil/password
router.put('/password', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }

    const { contra_actual, nueva_contra, nueva_contra_2 } = req.body;

    if (!contra_actual || !nueva_contra || !nueva_contra_2) {
      return res.status(400).json({
        ok: false,
        message: 'Debes completar todos los campos.',
      });
    }

    if (nueva_contra !== nueva_contra_2) {
      return res
        .status(400)
        .json({ ok: false, message: 'Las contraseñas no coinciden.' });
    }

    if (!PASS_REGEX.test(nueva_contra)) {
      return res.status(400).json({
        ok: false,
        message:
          'La contraseña debe tener al menos 8 caracteres, incluir mayúscula, minúscula, número y símbolo.',
      });
    }

    const [rows] = await poolCibervoluntarios.query(
      'SELECT Contrasena FROM Usuarios WHERE id_usuario=?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const hashActual = rows[0].Contrasena;
    const ok = await bcrypt.compare(contra_actual, hashActual);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: 'La contraseña actual es incorrecta.' });
    }

    if (await bcrypt.compare(nueva_contra, hashActual)) {
      return res.status(400).json({
        ok: false,
        message:
          'La nueva contraseña no puede ser igual a la contraseña actual.',
      });
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const nuevoHash = await bcrypt.hash(nueva_contra, saltRounds);

    const [u] = await poolCibervoluntarios.query(
      'UPDATE Usuarios SET Contrasena=? WHERE id_usuario=?',
      [nuevoHash, userId]
    );

    if (u.affectedRows === 0) {
      return res.status(500).json({
        ok: false,
        message: 'No fue posible actualizar la contraseña.',
      });
    }

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente. Por seguridad, tendrás que volver a iniciar sesión.',
    });
  } catch (err) {
    console.error('PUT /perfil/password error:', err);
    return res.status(500).json({
      ok: false,
      message:
        'Error en el servidor al cambiar la contraseña. Intenta más tarde.',
    });
  }
});

// =========================
// 3) Solicitar traspaso de sede
// =========================
// POST /dashboard/perfil/traspaso
router.post('/traspaso', async (req, res) => {
  const conn = await poolCibervoluntarios.getConnection();
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      conn.release();
      return res
        .status(401)
        .json({ ok: false, message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }

    const { cod_sede_nueva } = req.body;
    const cod = Number(cod_sede_nueva);

    if (!Number.isInteger(cod)) {
      conn.release();
      return res
        .status(400)
        .json({ ok: false, message: 'Debes seleccionar una sede válida.' });
    }

    // Verifica que la sede exista en Duoc
    const [sedes] = await poolDuoc.query('SELECT cod_sede FROM Sedes WHERE cod_sede=?', [cod]);
    if (sedes.length === 0) {
      conn.release();
      return res.status(400).json({ ok: false, message: 'La sede seleccionada no existe.' });
    }

    const [meRows] = await poolCibervoluntarios.query(
      'SELECT cod_sede, Activo FROM Usuarios WHERE id_usuario=?',
      [userId]
    );
    if (meRows.length === 0) {
      conn.release();
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    const actual = Number(meRows[0].cod_sede);
    if (actual === cod) {
      conn.release();
      return res.status(400).json({
        ok: false,
        message: 'Ya perteneces a esa sede.',
      });
    }

    await conn.beginTransaction();

    // 1) Cambia la sede y desactiva al usuario
    const [upd] = await conn.query(
      'UPDATE Usuarios SET cod_sede=?, Activo=0 WHERE id_usuario=?',
      [cod, userId]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      conn.release();
      return res.status(500).json({
        ok: false,
        message: 'No fue posible solicitar el traspaso.',
      });
    }

    // (Opcional) Podrías insertar un registro de auditoría/solicitud aquí.
    // await conn.query('INSERT INTO Solicitudes_Traslado(...) VALUES (...)', [...]);

    await conn.commit();
    conn.release();

    // Limpia sesión localmente para forzar re-login
    req.session.user = {
      ...req.session.user,
      cod_sede: cod,
      // marcamos inactivo también en sesión si lo necesitas en tus vistas:
      Activo: 0,
    };

    return res.json({
      ok: true,
      message:
        'Solicitud enviada. Tu cuenta fue desactivada hasta que la sede receptora te reactive.',
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    console.error('POST /perfil/traspaso error:', err);
    return res.status(500).json({
      ok: false,
      message:
        'Error al procesar el traspaso de sede. Intenta nuevamente más tarde.',
    });
  }
});


// =========================
//  Cambiar icono
// =========================
// PUT /dashboard/perfil/icono
router.post('/icono/:id', async (req, res) => {
    try {
        const idUsuario = req.body.ID;
        const idIcono = req.body.Icono;

        await poolCibervoluntarios.query(
            `UPDATE Usuarios SET id_Icono = ? WHERE id_usuario = ?`,
            [idIcono, idUsuario]
        );

        req.session.user = {
          ...req.session.user,
          icono: idIcono,
          
        };
        console.log('Icono de usuario actualizado exitosamente');
        res.json({ message: 'Icono actualizado correctamente' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error al actualizar el icono' });
    }
});

export default router;
