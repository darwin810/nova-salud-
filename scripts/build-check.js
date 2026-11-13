const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(full) : entry.isFile() && full.endsWith('.js') ? [full] : [];
  });
}

const root = path.resolve(__dirname, '..');
const files = [...javascriptFiles(path.join(root, 'src')), ...javascriptFiles(path.join(root, 'public'))];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Error de sintaxis en ${file}\n`);
    process.exit(result.status || 1);
  }
}
for (const file of ['src/views/index.html', 'public/styles.css', 'public/app.js']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Falta un archivo requerido: ${file}`);
}
console.log(`Compilación correcta: ${files.length} archivos JavaScript revisados.`);
