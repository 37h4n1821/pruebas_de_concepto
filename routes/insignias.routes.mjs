import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


// /dashboard/insignias/mis
router.get('/mis', async (req, res) => {
    res.render('pages/private/Construccion', 
    {
        Usuario:req.session.user
    });

});
// /dashboard/insignias/administracion
router.get('/administracion', async (req, res) => {
    res.render('pages/private/Construccion', 
    {
        Usuario:req.session.user
    });    

});


export default router;
