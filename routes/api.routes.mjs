import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


// /api/
router.get('/', async (req, res) => {
    res.json({API:"V1.0.1",Servicios:"Cibervoluntarios"});
});
// /api/usuarios/obtener/:uuid
router.get('/usuarios/obtener/:uuid', async (req, res) => {
    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Usuarios_Vista` WHERE id_usuario=? && Activo=1',[req.params.uuid]);
    if(rols.length===0){
        return res.json({Error:"Datos no econtrados"});
    }
    res.json(rols[0]);
});

// /api/sedes/obtener
router.get('/sedes/obtener/', async (req, res) => {
    const [rols] = await poolDuoc.query('SELECT * FROM `Sedes`',[]);
    if(rols.length===0){
        return res.json({Error:"Datos no econtrados"});
    }
    res.json(rols);
});

// /api/eventos/obtener
router.get('/eventos/obtener/', async (req, res) => {
    const [rols] = await poolCibervoluntarios.query('SELECT Code,Nombre,Descripcion FROM `Eventos_Vista`',[]);
    if(rols.length===0){
        return res.json({Error:"Datos no econtrados"});
    }
    res.json(rols);
});

// /api/eventos/obtener/:uuid
router.get('/eventos/obtener/:uuid', async (req, res) => {
    const [rols] = await poolCibervoluntarios.query('SELECT * FROM `Eventos_Vista`',[]);
    if(rols.length===0){
        return res.json({Error:"Datos no econtrados"});
    }
    res.json(rols);
});


export default router;
