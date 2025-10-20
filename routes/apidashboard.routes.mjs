import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


// /dashboard/api/
router.get('/', async (req, res) => {
    res.json({API:"V1.0.1",Servicios:"Cibervoluntarios dashboard"});
});
// /dashboard/api//usuarios/obtener/:uuid
router.get('/notificaciones', async (req, res) => {
    
});


export default router;
