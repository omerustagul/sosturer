
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const jwt = require('jsonwebtoken');

const USER_ID = 'f4e09220-6be2-43a5-a08c-599227841581'; // Omer
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

async function test_api() {
  const endpoints = ['/machines', '/production-records'];
  
  for (const ep of endpoints) {
    const res = await fetch(`http://localhost:3001/api${ep}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`${ep} count:`, Array.isArray(data) ? data.length : 'NOT AN ARRAY');
    if (Array.isArray(data) && data.length > 0) {
        console.log(`Sample ${ep}:`, data[0].id);
    }
  }
}

test_api().catch(e => console.error(e));
