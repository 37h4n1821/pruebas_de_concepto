import { Router } from 'express';
import { poolDuoc, poolCibervoluntarios } from '../db/pools.mjs';
import ExcelJS from 'exceljs';

const router = Router();


// /dashboard/calendario/global
router.get('/global', async (req, res) => {
    const [resulteventos] = await poolCibervoluntarios.query('SELECT * FROM `Eventos_Vista` where Id_Sede = 44 OR Intersede=1',[]);


    if (req.isMobile) {
        res.render('pages/private/Calendario_Global_Movil', 
        {
            Usuario:req.session.user,
            Eventos:resulteventos
        });
    } else {
        res.render('pages/private/Calendario_Global', 
        {
            Usuario:req.session.user,
            Eventos:resulteventos
        });
    }

});
// /dashboard/calendario/sede
router.get('/sede', async (req, res) => {


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


    
    const [resulteventos] = await poolCibervoluntarios.query('SELECT * FROM `Eventos_Vista` where Id_Sede = ?',[sedeFiltrada]);


    if (req.isMobile) {
        res.render('pages/private/Calendario_Sede_Movil', 
        {
            Sedes: resultadoSedes,
            SedeSeleccionada: sedeFiltrada,
            Usuario:req.session.user,
            Eventos:resulteventos
        });
    } else {
        res.render('pages/private/Calendario_Sede', 
        {
            Sedes: resultadoSedes,
            SedeSeleccionada: sedeFiltrada,
            Usuario:req.session.user,
            Eventos:resulteventos
        });
    }
        
    

});


export default router;
