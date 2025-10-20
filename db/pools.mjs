import mysql from 'mysql2/promise';
import 'dotenv/config';

export const poolDuoc = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.ApiDB,
    password: process.env.ApiDBpass,
    database: 'Duoc',
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0
});

export const poolCibervoluntarios = mysql.createPool({
    host: '127.0.0.1',
    user: process.env.ApiDB,
    password: process.env.ApiDBpass,
    database: 'Cibervoluntarios',
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0
});
