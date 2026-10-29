import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Local signing identity is supplied by the operator; no private key or
// machine-specific keychain location belongs in source control.
if (process.platform !== 'darwin') throw new Error('Build này yêu cầu macOS.');
const identity = process.env.VXCLEAN_CODESIGN_IDENTITY;
const expectedSigner = 'FE024021592C718A39AD70B76D2EDC5DA0CD6B70';
if (!identity || identity.toUpperCase() !== expectedSigner) throw new Error('Cần đúng VXCLEAN_CODESIGN_IDENTITY hiện có; không đổi signer trong build thường.');
const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('npm', ['--prefix', 'desktop', 'run', 'tauri', '--', 'build', '--bundles', 'app',
  '--config', JSON.stringify({ bundle: { createUpdaterArtifacts: false, macOS: { signingIdentity: identity } } })]);
const app = resolve(root, 'desktop/src_tauri/target/release/bundle/macos/VXClean.app');
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
const requirement = spawnSync('/usr/bin/codesign', ['-d', '-r-', app], { encoding: 'utf8' });
const output = `${requirement.stdout ?? ''}${requirement.stderr ?? ''}`;
const dr = output.split('\n').find(line => line.startsWith('designated => ')) ?? '';
if (requirement.status !== 0 || !dr.includes('identifier "com.vxclean.desktop"') ||
    !dr.toUpperCase().includes(`CERTIFICATE LEAF = H"${expectedSigner}"`) || /\bcdhash\b|\bor\b/.test(dr)) {
  throw new Error('Gói chưa có designated requirement ràng buộc certificate.');
}
console.log(output.trim());
