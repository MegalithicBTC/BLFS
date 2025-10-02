/**
 * Purpose: programmatically deploy/upgrade the Checkout UI extension using the per‑shop Partner CLI token.
 * Called by: dev route POST /dev/shops/:publicId/partner-cli/deploy.
 * Sequence: run after saving API key/secret and enabling network access + Custom distribution in Partner Dashboard.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { Shop } from '../store/entities/Shop';
import { decryptString } from './crypto';

const EXT_SRC = path.join('/workspace', 'shopify-extension', 'thank-you');

async function rmrf(p: string) { try { await fsp.rm(p, { recursive: true, force: true }); } catch {} }
async function mkdirp(p: string) { await fsp.mkdir(p, { recursive: true }); }
async function copyDir(src: string, dst: string) {
  await mkdirp(dst);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isSymbolicLink()) await fsp.symlink(await fsp.readlink(s), d);
    else await fsp.copyFile(s, d);
  }
}

function renderAppToml(appName: string, clientId: string, appUrl: string, publicId: string) {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-07';
  return [
    `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration`,
    `name = "${appName}"`,
    ``,
    `client_id = "${clientId}"`,
    `application_url = "${appUrl}"`,
    `embedded = false`,
    ``,
    `[access_scopes]`,
    `scopes = "read_orders,write_orders"`,
    ``,
    `[auth]`,
    `redirect_urls = ["${appUrl}/dev/admin-oauth/callback"]`,
    ``,
    `[webhooks]`,
    `api_version = "${apiVersion}"`,
    ``,
    `[[webhooks.subscriptions]]`,
    `topics = ["orders/create"]`,
    `uri = "/webhooks/orders-create"`,
    ``,
    `[[webhooks.subscriptions]]`,
    `topics = ["app/uninstalled"]`,
    `uri = "/webhooks/app-uninstalled"`,
    ``
  ].join('\n');
}


export async function deployThankYouExtension(shop: Shop): Promise<{ ok: boolean; log: string }> {
  const token = decryptString(shop.partnerCliToken || '') || '';
  const clientId = decryptString(shop.shopifyApiKey || '') || '';
  if (!token) throw new Error('partner-cli-token-missing');
  if (!clientId) throw new Error('shopify-client-id-missing');

  const appUrl = `https://${process.env.THIS_APP_DOMAIN}`;
  const tempRoot = path.join('/tmp', `shopify-deploy-${shop.publicId}`);
  const appDir = path.join(tempRoot, 'app');
  const extDir = path.join(appDir, 'extensions', 'nwc-thankyou');

  await rmrf(tempRoot);
  await mkdirp(extDir);

  // app config
  const appToml = renderAppToml('BLFS', clientId, appUrl, shop.publicId);
  console.log("about to write this app.toml:\n", appToml);
  await fsp.writeFile(path.join(appDir, 'shopify.app.toml'), appToml, 'utf8');

  // Create package.json for app directory (required by Shopify CLI)
  const appPackageJson = {
    name: 'blfs-shopify-app',
    version: '1.0.0',
    private: true,
    type: 'module'
  };
  await fsp.writeFile(path.join(appDir, 'package.json'), JSON.stringify(appPackageJson, null, 2), 'utf8');

  // copy extension sources
  await copyDir(EXT_SRC, extDir);

  // replace placeholders in entry
  const entryFile = path.join(extDir, 'src', 'index.jsx');
  let code = await fsp.readFile(entryFile, 'utf8');
  code = code.replace(/__APP_DOMAIN__/g, String(process.env.THIS_APP_DOMAIN || '')).replace(/__PUBLIC_ID__/g, shop.publicId);
  await fsp.writeFile(entryFile, code, 'utf8');

  // install extension deps (idempotent)
  if (!fs.existsSync(path.join(extDir, 'node_modules'))) {
    await new Promise<void>((resolve, reject) => {
      const pr = spawn('npm', ['install', '--no-audit', '--no-fund'], { cwd: extDir, stdio: 'inherit' });
      pr.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`npm install failed: ${code}`)));
    });
  }

  // Initialize Git repository (required by Shopify CLI)
  if (!fs.existsSync(path.join(appDir, '.git'))) {
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['init'], { cwd: appDir, stdio: 'inherit' });
      git.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git init failed: ${code}`)));
    });
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['config', 'user.email', 'deploy@blfs.local'], { cwd: appDir, stdio: 'inherit' });
      git.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git config email failed: ${code}`)));
    });
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['config', 'user.name', 'BLFS Deploy'], { cwd: appDir, stdio: 'inherit' });
      git.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git config name failed: ${code}`)));
    });
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['add', '.'], { cwd: appDir, stdio: 'inherit' });
      git.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git add failed: ${code}`)));
    });
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['commit', '-m', 'Initial commit'], { cwd: appDir, stdio: 'inherit' });
      git.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git commit failed: ${code}`)));
    });
  }

  // deploy via Shopify CLI
  const env = { ...process.env, SHOPIFY_CLI_PARTNERS_TOKEN: token, SHOPIFY_API_KEY: clientId };
  const args = ['-y', '@shopify/cli@latest', 'app', 'deploy', '-f'];
  const logs: string[] = [];
  
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npx', args, { cwd: appDir, env });
      child.stdout.on('data', (d) => logs.push(d.toString()));
      child.stderr.on('data', (d) => logs.push(d.toString()));
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          logs.push(`\n\nDeploy failed with exit code: ${code}`);
          reject(new Error(`shopify deploy failed: ${code}`));
        }
      });
    });
    return { ok: true, log: logs.join('') };
  } catch (err) {
    // Return logs even on failure so user can see what went wrong
    return { ok: false, log: logs.join('') || String(err) };
  }
}