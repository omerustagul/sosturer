
const http = require('http');
const jwt = require('jsonwebtoken');

const USER_ID = 'f4e09220-6be2-43a5-a08c-599227841581';
const EMAIL = 'grafik@medisolaris.com';
const ROLE = 'superadmin';
const COMPANY_ID = 'medisolaris-main';
const SECRET = 'gizli-super-secret-key-123';

function makeToken(u) {
  return jwt.sign(
    { id: u.id, email: u.email, role: u.role, fullName: u.fullName, companyId: u.companyId },
    SECRET,
    { expiresIn: '24h' }
  );
}

const token = makeToken({ id: USER_ID, email: EMAIL, role: ROLE, fullName: 'Ömer Baran Ustagül', companyId: COMPANY_ID });

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3001,
      path: '/api' + path,
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const machines = await get('/machines');
  const records = await get('/production-records');
  console.log('Machines count:', Array.isArray(machines) ? machines.length : 'ERROR: ' + machines);
  console.log('Records count:', Array.isArray(records) ? records.length : 'ERROR: ' + records);
}

run();
