import 'dotenv/config';


import express from 'express';
import { Server as ServerIO } from "socket.io";
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import mysql from 'mysql2/promise';
import session from 'express-session';
import sharedsession from "express-socket.io-session";
import bodyParser from 'body-parser';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import dayjs from 'dayjs'; // para manejar fechas fácilmente
import isBetween from 'dayjs/plugin/isBetween.js';
dayjs.extend(isBetween);
import transporter from "./private/mailer.js";
import Mail from "./private/correos_plantillas.js";



import eventosRoutes from './routes/eventos.routes.mjs';
import calendarioRoutes from './routes/calendario.routes.mjs';
import usuariosRoutes from './routes/usuarios.routes.mjs';
import perfilRoutes from './routes/perfil.routes.mjs';
import apiRoutes from './routes/api.routes.mjs';
import apidashboardRoutes from './routes/apidashboard.routes.mjs';
import insigniasRoutes from './routes/insignias.routes.mjs';

const poolDuoc = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.ApiDB,
    password: process.env.ApiDBpass,
    database: 'Duoc',
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0

});

const poolCibervoluntarios = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.ApiDB,
    password: process.env.ApiDBpass,
    database: 'Cibervoluntarios',
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0

});


function extraerFecha(date) {
    const fecha = new Date(date);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0'); // getMonth() retorna mes desde 0 (enero)
    const año = fecha.getFullYear();
    return `${dia}-${mes}-${año}`;
}

function extraerHora(date) {
    const fecha = new Date(date);
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
}


const app = express();
const server = http.createServer(app);


const io = new ServerIO(server, {
    cors: {
        origin: "https://cibervoluntarios.cittpass.cl/",
        methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => { funciones_socket(io)(socket); });




const expressSession = session({
    secret: process.env.secretKeyDuocsession,
    resave: false,
    saveUninitialized: false,
    cookie: {
        domain: 'cibervoluntarios.cittpass.cl', // Incluye subdominios

        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 1 * 60 * 60 * 1000
    }

});




app.use(express.urlencoded({ extended: true }));
app.use(expressSession);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
io.use(sharedsession(expressSession));
app.use(cookieParser());


app.use(express.static(__dirname + '/public'));
app.use((req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);

  req.isMobile = isMobile;
  next();
});


app.set('view engine', 'ejs');
app.set('views', './viewsejs');


// Route to render the main page
app.get('/', async (req, res) => {
    res.redirect('/dashboard');
});



/* ─── RUTAS LOGIN ───────────────────────── */

const salting = 10;


app.get('/auth', async (req, res) => {
    const tituloModal = req.session.error?.titulo || null;
    const descripcionModal = req.session.error?.descripcion || null;
    const iconoModal = req.session.error?.icono || null;

    const querySedes = 'SELECT * FROM Sedes';
    const queryCarreras = 'SELECT * FROM Carreras_Sedes_Vista';
    const queryJornadas = 'SELECT * FROM Jornadas';
    const queryTipoRol = 'SELECT * FROM Rol LIMIT 2';
    const [resultadoTipoRol] = await poolCibervoluntarios.query(queryTipoRol);
    const [resultadoSedes] = await poolDuoc.query(querySedes);
    const [resultadoJornadas] = await poolDuoc.query(queryJornadas);
    const [resultadoCarreras] = await poolDuoc.query(queryCarreras);
    


    req.session.error = null;

    res.render('pages/public/login', { tituloModal, descripcionModal, iconoModal, Sedes: resultadoSedes, Carreras: resultadoCarreras, Jornada: resultadoJornadas, TipoRol: resultadoTipoRol});
});

app.post('/auth/registro', async (req, res)=>{
        try {
        const { nombre, apellidoP, apellidoM, celular, correoRegistro, passwordRegistro } = req.body;
        const jornada = req.body.jornada || null;
        const carrera = req.body.carrera || null;
        const sede = req.body.sede || req.body.sedeColaborador || 44;
        let rolDado = req.body.registerRol || 4;

        if (rolDado === 'colaborador'){
            rolDado = 2
        }

        if (!nombre || !apellidoP || !apellidoM || !celular || !correoRegistro || !passwordRegistro) {
            return res.status(400).json({ error: "Datos faltantes" });

        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(correoRegistro)) {

            return res.status(400).json({ error: "El correo electrónico no cumple con el formato esperado." });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(passwordRegistro)) {
            return res.status(400).json({ error: "La contraseña no cumple con el formato esperado." });

        }


        if (!celular.startsWith('+') || !/^\+\d+$/.test(celular) || celular.substring(1).length > 15) {

            return res.status(400).json({ error: "El número de celular no cumple con el formato esperado." });
        }

        const [existingTel] = await poolCibervoluntarios.query("SELECT id_usuario FROM Usuarios WHERE Celular = ?", [celular]);
        if (existingTel.length > 0) {

            return res.status(400).json({ error: "El número de celular ingresado ya está asociado a una cuenta." });
        }

        const correosExcepcion = ["di.sanchez@duocuc.cl", "et.leiva@duocuc.cl"];
        const [existingMail] = await poolCibervoluntarios.query("SELECT id_usuario FROM Usuarios WHERE Correo = ?", [correoRegistro]);
        if (existingMail.length > 0 && !correosExcepcion.includes(correoRegistro)) {
            return res.status(400).json({ error: "El correo electrónico ingresado ya está asociado a una cuenta." });

        }
        let icono = Math.floor(Math.random() * 6) + 1;

        const hashedPassword = await bcrypt.hash(passwordRegistro, salting);

        const result = await poolCibervoluntarios.query(
            "INSERT INTO Usuarios (Nombre, Apellido_Paterno, Apellido_Materno, Correo, Celular, Contrasena,cod_sede , ID_Carrera,Cod_Jornada, id_rol,id_Icono,Activo) VALUES (?,?, ?, ?, ?, ?, ?, ?,?,?,?,?)",
            [nombre, apellidoP, apellidoM, correoRegistro, celular, hashedPassword, sede, carrera,jornada, rolDado, icono,0]
        );
        

    return res.status(200).json({ message: "Registro exitoso" });


    } catch (error) {
        return res.status(500).json({ error: "Intente nuevamente más tarde..." });

    }
})





app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            
            return res.status(400).json({ error: "El correo o la contraseña no son válidos. Inténtalo nuevamente." });

        }
        // Buscar el usuario en la base de datos
        const [rows] = await poolCibervoluntarios.query("SELECT * FROM Usuarios WHERE Correo = ?", [email]);
        if (rows.length === 0) {
           return res.status(400).json({ error: "El correo o la contraseña no son válidos. Inténtalo nuevamente." });
;
        }
        const user = rows[0];

        if (user.Activo===0){
           return res.status(400).json({ error: "El usuario no ha sido activado" });
        }

        // Comparar la contraseña hasheada
        const match = await bcrypt.compare(password, user.Contrasena);
        if (!match) {
          return res.status(400).json({ error: "El correo o la contraseña no son válidos. Inténtalo nuevamente." });

        }

          //Crear JWT válido por 1 día
        const token = jwt.sign(
            { id: user.id_usuario, email: user.Correo, Nombre: user.Nombre, cod_sede: user.cod_sede },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

         //Guardar datos relevantes del usuario en la sesión
        req.session.user = {
            ID: user.id_usuario,
            Correo: user.Correo,
            Nombre: user.Nombre,
            Apellido_P: user.Apellido_Paterno,
            Apellido_M: user.Apellido_Materno,
            Celular:user.Celular,
            cod_sede: user.cod_sede,
            rol: user.id_rol,
            icono: user.id_Icono
        };

         //Guardar token en cookie httpOnly
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        return res.status(200).json({ redirect: '/dashboard' });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: "Intente nuevamente más tarde, si el error persiste, contáctese con el soporte." });

    }
});

/* RECUPERAR */
app.post('/auth/recuperar', async (req, res) => {
    const { emailRecuperar } = req.body;

    if (!emailRecuperar) {
        return res.status(400).json({ error: "Datos faltantes" });
    }

    const [consulta] = await poolCibervoluntarios.query(
        'SELECT id_usuario, Nombre, Correo FROM Usuarios WHERE Correo = ?', 
        [emailRecuperar]
    );

    if (consulta.length === 0) {
        // aunque no exista, respondemos igual para no filtrar usuarios
        return res.status(200).json({ success: "Si el correo indicado pertenece a una cuenta activa en CiberVoluntarios le llegará un correo de verificación" });
    }

    const userId = consulta[0].id_usuario;
    if (!userId) {
        return res.status(200).json({ success: "Si el correo indicado pertenece a una cuenta activa en CiberVoluntarios le llegará un correo de verificación" });
    }

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '20m' });
    const resetLink = `https://cibervoluntarios.cittpass.cl/reset-password/${token}`;

    const mailOptions = {
        from: { address: "soporte@cittpass.cl", name: "CiberVoluntarios" },
        to: [
            { email_address: { address: emailRecuperar, name: consulta[0].Nombre } }
        ],
        subject: Mail.recuperar_contraseña.subject,
        htmlbody: Mail.recuperar_contraseña.html.replace("{{resetLink}}", resetLink)
    };

    try {
        const result = await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: "Si el correo indicado pertenece a una cuenta activa en CiberVoluntarios le llegará un correo de verificación" });

    } catch (error) {
        console.error("Error enviando correo:", error);
        return res.status(500).json({ error: "Ha habido un problema. Si el error persiste contacte a su coordinador." });
    }
});


app.get('/reset-password/:token', (req, res) => {

    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded) {
            res.render('pages/public/recuperar', {  token });
        } else{
            res.render('pages/public/recuperarInvalido')
        }
    } catch (error) {
        res.render('pages/public/recuperarInvalido')

    }


});


app.post('/reset-password/:token', async (req, res) => {
    const { contrasegnaRestablecer } = req.body;
    const { token } = req.params;

    if (!contrasegnaRestablecer) {
        return res.status(400).json({ error: "Datos faltantes" });

    }

    // Validar que la contraseña cumpla con los requisitos
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(contrasegnaRestablecer)) {
            return res.status(400).json({ error: "Contraseña no cumple con los requerimientos" });

    }

    try {
        // Verificar el token y extraer el ID del usuario
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id; // Aquí obtenemos el ID del usuario
        const hashedPassword = await bcrypt.hash(contrasegnaRestablecer, salting);

        const [result] = await poolCibervoluntarios.query("UPDATE Usuarios SET Contrasena = ? WHERE id_usuario = ?", [hashedPassword, userId]
        );


        return res.status(200).json({ success: "La contraseña ha sido correctamente restablecida." });


    } catch (error) {
        return res.status(400).json({ error: "Error interno. Si el error persiste contactar con su coordinador." });

    }
});



/* INGRESAR NUEVA CONTRASEÑA GET Y POST */






/* ─── LOG OUT ───────────────────────────────────────────── */

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).send('Error al cerrar sesión');
        }
        res.clearCookie('token');
        res.redirect('/auth');
    });
});

/* ─── MIDDLEWARE PARA PROTEGER RUTAS PRIVADAS ──────────────── */

const authenticateJWT = async (req, res, next) => {
    // Modo desarrollo: se utiliza un usuario por defecto
    if (process.env.DEVELOP && process.env.DEVELOP === 'true') {
        if (!req.session.user) {
            try {
                const [rows] = await poolCibervoluntarios.query("SELECT * FROM Usuarios LIMIT 1");
                if (rows.length === 0) {
                    return res.status(500).send("No se encontró un usuario por defecto en la BD");
                }
                const user = rows[0];
                // Crear JWT válido por 1 día
                const token = jwt.sign(
                    { id: user.id_usuario, email: user.Correo, Nombre: user.Nombre, cod_sede: user.cod_sede },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' }
                );
                // Guardar datos relevantes del usuario en la sesión
                req.session.user = {
                    ID: user.id_usuario,
                    Correo: user.Correo,
                    Nombre: user.Nombre,
                    Apellido_P: user.Apellido_Paterno,
                    Apellido_M: user.Apellido_Materno,
                    Celular:user.Celular,
                    cod_sede: user.cod_sede,
                    rol:user.id_rol,
                    icono: user.id_Icono
                };
                // Guardar token en cookie httpOnly
                res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
                req.user = req.session.user;
            } catch (error) {
                console.error("Error al obtener usuario por defecto:", error);
                return res.status(500).send("Error en la autenticación en modo desarrollo");
            }
        }
        return next();
    }

    // Modo producción: autenticación con JWT
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        return res.redirect('/auth');
    }
    try {
        // Verificar el token de forma síncrona
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Si la sesión no está definida, obtenemos los datos completos del usuario desde la BD
        const [rows] = await poolCibervoluntarios.query("SELECT * FROM Usuarios WHERE id_usuario  = ? and Activo=1", [decoded.id]);
        if (rows.length === 0) {
            return res.redirect('/auth');
        }
        const user = rows[0];
        req.session.user = {
            ID: user.id_usuario,
            Correo: user.Correo,
            Nombre: user.Nombre,
            Apellido_P: user.Apellido_Paterno,
            Apellido_M: user.Apellido_Materno,
            Celular:user.Celular,
            cod_sede: user.cod_sede,
            rol:user.id_rol,
            icono: user.id_Icono
        };
        req.user = req.session.user;
        return next();
    } catch (error) {
        console.error("Error al verificar el JWT:", error);
        return res.redirect('/auth');
    }
};

/* ─── RUTAS LOGIN ───────────────────────── */

app.use('/dashboard', authenticateJWT);

/* ─── RUTAS PRIVADAS (DASHBOARD) ───────────────────────── */


app.get('/dashboard', async (req, res) => {

    const [resultados_sedes] = await poolDuoc.query("SELECT * FROM Sedes ORDER BY cod_sede");
    const [resultados_usuarios] = await poolCibervoluntarios.query("SELECT * FROM `Usuarios` WHERE Activo=1 ORDER BY cod_sede");
    const [resultados_eventos] = await poolCibervoluntarios.query("SELECT * FROM `Eventos` WHERE Estatus=3");

    // Conteo usuarios por sede
    const conteoPorSede = resultados_usuarios.reduce((acc, user) => {
        acc[user.cod_sede] = (acc[user.cod_sede] || 0) + 1;
        return acc;
    }, {});

    const resultado = resultados_sedes.map(sede => ({
        ...sede,
        cantidad_usuarios: conteoPorSede[sede.cod_sede] || 0
    }));

    // ---- Eventos de esta semana ----
    const inicioSemana = dayjs().startOf('week'); // Domingo 00:00
    const finSemana = dayjs().endOf('week');     // Sábado 23:59

    const eventosSemana = resultados_eventos.filter(evento => {
        const fechaInicio = dayjs(evento.Fecha_inicio);
        return fechaInicio.isBetween(inicioSemana, finSemana, null, '[]');
    });

    // ---- Usuarios nuevos de esta semana ----
    const usuariosSemana = resultados_usuarios.filter(usuario => {
        const fechaActivacion = dayjs(usuario.fecha_activacion);
        return fechaActivacion.isBetween(inicioSemana, finSemana, null, '[]');
    });

    // ---- Usuarios nuevos de la semana anterior ----
    const inicioSemanaAnterior = inicioSemana.subtract(1, 'week');
    const finSemanaAnterior = finSemana.subtract(1, 'week');

    const usuariosSemanaAnterior = resultados_usuarios.filter(usuario => {
        const fechaActivacion = dayjs(usuario.fecha_activacion);
        return fechaActivacion.isBetween(inicioSemanaAnterior, finSemanaAnterior, null, '[]');
    });

    // ---- Porcentaje de aumento ----
    const aumentoUsuarios = usuariosSemanaAnterior.length === 0 
        ? 100 
        : Math.round(((usuariosSemana.length - usuariosSemanaAnterior.length) / usuariosSemanaAnterior.length) * 100);
    
        // ---- Próximos 3 eventos ----
    const ahora = dayjs();
    const proximosEventos = resultados_eventos
        .filter(evento => dayjs(evento.Fecha_inicio).isAfter(ahora))
        .sort((a, b) => new Date(a.Fecha_inicio) - new Date(b.Fecha_inicio))
        .slice(0, 3);

    // Renderizar dashboard
    res.render('pages/private/dashboard', {    
        Usuario: req.session.user,
        Sedes: resultado,
        Usuarios: resultados_usuarios,
        Eventos: resultados_eventos,
        EventosSemana: eventosSemana.length,
        UsuariosSemana: usuariosSemana.length,
        PorcentajeUsuarios: aumentoUsuarios,
        ProximosEventos: proximosEventos
    });
});

/* ─── RUTAS PRIVADAS (Eventos) ───────────────────────── */


// Montamos las rutas
app.use('/dashboard/eventos', eventosRoutes);
app.use('/dashboard/calendario', calendarioRoutes);
app.use('/dashboard/usuarios', usuariosRoutes);
app.use('/dashboard/perfil', perfilRoutes);
app.use('/dashboard/insignias', insigniasRoutes);
app.use('/dashboard/api', apidashboardRoutes);
app.use('/api', apiRoutes);

/* ─── RUTAS PRIVADAS (Eventos) ───────────────────────── */
/* ─── RUTAS PRIVADAS (Usuarios) ───────────────────────── */

/*

req.session.user = {
                    ID: user.id_usuario,
                    Correo: user.Correo,
                    Nombre: user.Nombre,
                    Apellido_P: user.Nombre,
                    Apellido_M: user.Nombre,
                    Celular: user.Celular,
                    cod_sede: user.cod_sede,
                    rol:user.id_rol
                };

*/


/* ─── RUTAS PRIVADAS (Usuarios) ───────────────────────── */

app.get('/dashboard/lector_qr', async (req, res) => {

    res.render('pages/private/escanner', {
    Usuario:req.session.user});
});


app.get('/dashboard/apis', async (req, res) => {

    res.render('pages/private/apis', {
    Usuario:req.session.user});
});


app.get('/dashboard/testv1', async (req, res) => {

    res.render('pages/private/SinPermisos', {
    Usuario:req.session.user});
});


app.get('/lector_qr/:codigo', async (req, res) => {

    const [rows] = await poolCibervoluntarios.query('SELECT * FROM Eventos WHERE code = ?', [req.params.codigo]);

    res.render('pages/public/escaner', {Evento:rows[0]});


});

app.get('/inscripcion/:codigo', async (req, res) => {

    const querySedes = 'SELECT * FROM Sedes';
    const [resultadoSedes] = await poolDuoc.query(querySedes);

    const [rows] = await poolCibervoluntarios.query('SELECT * FROM Eventos WHERE code = ?', [req.params.codigo]);

    res.render('pages/public/inscribir', {
        Evento:rows[0],
        Sedes: resultadoSedes
    }
    );


});


// Registrar inscripción a un evento
app.post('/inscripcion/:codigo', async (req, res) => {
  try {
    const codigo = req.params.codigo;
    
    const { 
      nombres,
      apellido_p,
      apellido_m,
      correo,
      pertenece_duoc,
      tipo_duoc,
      sede_duoc,
      empresa_organizacion,
      empresa_nombre
    } = req.body;

    // 1) Buscar evento por código
    const [eventos] = await poolCibervoluntarios.query(
      'SELECT ID, Nombre_actividad FROM Eventos WHERE code = ? LIMIT 1',
      [codigo]
    );
    if (eventos.length === 0) {
      return res.status(404).json({ ok: false, message: 'Evento no encontrado' });
    }
    const evento = eventos[0];


    if (evento.registro_activo){
        return res.status(500).json({ ok: false, message: 'lo sentimos, este evento no acepta más inscripciones.' });
    }


    if (!nombres || !apellido_p || !correo) {
      return res.status(400).json({ ok: false, message: 'Completa los campos obligatorios' });
    }

    // 4) Evitar duplicados (ID_Evento + Correo)
    const [dup] = await poolCibervoluntarios.query(
      'SELECT 1 FROM Participantes_Evento WHERE ID_Evento = ? AND Correo = ? LIMIT 1',
      [evento.ID, correo]
    );
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ya estás inscrito en este evento con ese correo' });
    }

    // 5) Preparar campos según pertenencia
    let sede = null;
    let id_tipo = null;
    let empresaNombre = null;

    if (pertenece_duoc === 'si') {
      sede = sede_duoc || null;
      id_tipo = tipo_duoc || null;
    } else if (empresa_organizacion === 'si') {
      empresaNombre = empresa_nombre || null;
    }

    // 6) Insertar en BD
    const [ins] = await poolCibervoluntarios.query(
      `INSERT INTO Participantes_Evento
        (ID_Evento, Nombre, Apellido_Paterno, Apellido_Materno, Correo,
         NombreEmpresaOrganizacion, Sede, id_tipo, ID_Carrera, Cod_Jornada, Asistio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0)`,
      [
        evento.ID,
        nombres,
        apellido_p,
        apellido_m || null,
        correo,
        empresaNombre,
        sede,
        id_tipo
      ]
    );

    if (!ins.insertId) {
      return res.status(500).json({ ok: false, message: 'Error al registrar la inscripción' });
    }

    return res.json({ ok: true, message: '¡Inscripción registrada con éxito!\nTe llegará un correo con tu entrada.' });
  } catch (err) {
    console.error('Error inscripción:', err);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
});



app.get('/validar_credencial/:uuid', async (req, res) => {
    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Usuarios_Vista` WHERE id_usuario=? && Activo=1',[req.params.uuid]);
    if(rols.length===0){
        return res.json({Error:"Datos no econtrados"});
    }
    res.render('pages/public/perfil_credencial', {
        Usuario: rols[0]
    });
});

/* ─── RUTAS PRIVADAS (DASHBOARD) ───────────────────────── */

server.listen(process.env.SERVER_PORT_NODEJS, () => {
    console.log(`🚀 Server ready at http://181.212.85.6:${process.env.SERVER_PORT_NODEJS}`);
});
