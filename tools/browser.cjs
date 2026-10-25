const fs = require('node:fs');
const path = require('node:path');
function browserOptions() {
  const edge = path.join(
    process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)',
    'Microsoft/Edge/Application/msedge.exe',
  );
  return {
    headless: true,
    ...(process.platform === 'win32' && fs.existsSync(edge) ? { executablePath: edge } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  };
}
module.exports = { browserOptions };
