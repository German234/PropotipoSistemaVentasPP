// Genera hashes bcrypt para el seed.
// Uso (desde la raíz del repo, con backend/node_modules instalado):
//   node db/genHash.js admin123 vendedor123
const path = require('path');
const bcrypt = require(require.resolve('bcryptjs', { paths: [path.join(__dirname, '..', 'backend')] }));

const claves = process.argv.slice(2);
if (claves.length === 0) {
  console.error('Uso: node db/genHash.js <password> [password ...]');
  process.exit(1);
}
for (const clave of claves) {
  console.log(`${clave} => ${bcrypt.hashSync(clave, 10)}`);
}
