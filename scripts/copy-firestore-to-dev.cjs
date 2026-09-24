// Uses the existing Firebase CLI session; never prints credentials or document data.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const SOURCE = 'sistema-financas';
const TARGET = 'sistema-financas-dev';
const root = project => `projects/${project}/databases/(default)/documents`;
const backupRoot = path.join(os.homedir(), '.codex', 'backups', 'sistema-financas');

async function main() {
  const cliRoot = process.env.FIREBASE_TOOLS_ROOT || path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools');
  const auth = require(path.join(cliRoot, 'lib', 'auth.js'));
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Faça login pelo Firebase CLI primeiro.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
  async function request(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`API ${response.status}: ${new URL(url).pathname}`);
    return response.json();
  }
  async function scan(project) {
    const documents = [];
    let parents = [root(project)];
    let visited = 0;
    while (parents.length) {
      const batch = parents.splice(0, 12);
      const children = await Promise.all(batch.map(async parent => {
        const found = [];
        let pageToken;
        do {
          const result = await request(`https://firestore.googleapis.com/v1/${parent}:listCollectionIds`, 'POST', { pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
          for (const id of result.collectionIds || []) {
            let next;
            do {
              const url = new URL(`https://firestore.googleapis.com/v1/${parent}/${encodeURIComponent(id)}`);
              url.searchParams.set('pageSize', '1000');
              url.searchParams.set('showMissing', 'true');
              if (next) url.searchParams.set('pageToken', next);
              const result = await request(url);
              for (const doc of result.documents || []) {
                found.push(doc.name);
                if (doc.createTime) documents.push(doc);
              }
              next = result.nextPageToken;
            } while (next);
          }
          pageToken = result.nextPageToken;
        } while (pageToken);
        return found;
      }));
      parents.push(...children.flat());
      visited += batch.length;
      if (visited % 120 < 12) console.log(`${project}: ${documents.length} documentos encontrados; ${parents.length} caminhos pendentes.`);
    }
    return documents.sort((a, b) => a.name.localeCompare(b.name));
  }
  const summary = docs => docs.reduce((result, doc) => {
    const collection = doc.name.split('/documents/')[1].split('/').filter((_, index) => index % 2 === 0).join('/');
    result[collection] = (result[collection] || 0) + 1;
    return result;
  }, {});
  const mode = process.argv[2];
  if (!['prepare', 'replace-dev'].includes(mode)) throw new Error('Use: node scripts/copy-firestore-to-dev.cjs prepare|replace-dev');
  const [source, target] = await Promise.all([scan(SOURCE), scan(TARGET)]);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join(backupRoot, stamp);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'production.json'), JSON.stringify({ project: SOURCE, documents: source }));
  await fs.writeFile(path.join(directory, 'dev-before.json'), JSON.stringify({ project: TARGET, documents: target }));
  const profile = docs => docs.filter(doc => /^users\/[^/]+$/.test(doc.name.split('/documents/')[1])).map(doc => ({ uid: doc.name.split('/').at(-1), email: doc.fields?.email?.stringValue, groupId: doc.fields?.groupId?.stringValue }));
  const sourceProfiles = profile(source), targetProfiles = profile(target);
  const matches = sourceProfiles.map(s => { const t = targetProfiles.find(t => t.email && t.email === s.email); return { matchedDevProfile: !!t, sameUid: t?.uid === s.uid, sameGroup: t?.groupId === s.groupId }; });
  console.log(JSON.stringify({ backupDirectory: directory, production: summary(source), dev: summary(target), profileMatches: matches }, null, 2));
  if (mode === 'prepare') return;
  if (!source.length) throw new Error('A origem está vazia; substituição cancelada.');

  // Authentication is separate from Firestore. Preserve existing dev logins and
  // map identities by verified email, rather than copying passwords/providers.
  const devUsers = [];
  let nextPageToken;
  do {
    const result = await request('https://www.googleapis.com/identitytoolkit/v3/relyingparty/downloadAccount', 'POST', {
      targetProjectId: TARGET, maxResults: 1000, ...(nextPageToken ? { nextPageToken } : {}),
    });
    devUsers.push(...(result.users || []).map(user => ({ uid: user.localId, email: user.email?.trim().toLowerCase() })));
    nextPageToken = result.nextPageToken;
  } while (nextPageToken);
  const uidMap = new Map();
  for (const profile of sourceProfiles) {
    const candidates = devUsers.filter(user => user.email && user.email === profile.email?.trim().toLowerCase());
    assert(candidates.length <= 1, 'E-mail ambíguo no Authentication de dev.');
    if (candidates.length) uidMap.set(profile.uid, candidates[0].uid);
    else assert(!devUsers.some(user => user.uid === profile.uid), 'UID de produção pertence a outro login de dev.');
  }
  const mapPath = name => {
    assert(name.startsWith(root(SOURCE) + '/'), 'Documento fora da origem esperada.');
    return root(TARGET) + '/' + name.slice(root(SOURCE).length + 1).split('/').map((part, index) => index % 2 ? uidMap.get(part) || part : part).join('/');
  };
  const transform = value => {
    if (Array.isArray(value)) return value.map(transform);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (key === 'stringValue' && uidMap.has(item)) return [key, uidMap.get(item)];
      if (key === 'referenceValue' && typeof item === 'string' && item.startsWith(root(SOURCE) + '/')) return [key, mapPath(item)];
      return [key, transform(item)];
    }));
  };
  const desired = source.map(doc => ({ name: mapPath(doc.name), fields: transform(doc.fields || {}) }));
  const names = new Set(desired.map(doc => doc.name));
  assert.equal(names.size, source.length, 'Colisão de documentos após mapear usuários.');
  const deletions = target.filter(doc => !names.has(doc.name));
  const plan = { source: SOURCE, target: TARGET, copiedDocuments: desired.length, deletedDevOnlyDocuments: deletions.length, mappedLogins: uidMap.size, profilesWithoutDevLogin: sourceProfiles.length - uidMap.size };
  await fs.writeFile(path.join(directory, 'plan.json'), JSON.stringify(plan, null, 2));
  await fs.writeFile(path.join(directory, 'dev-expected.json'), JSON.stringify({ project: TARGET, documents: desired }));
  console.log(JSON.stringify(plan));

  // Detect edits since the backup before touching the destination.
  const current = await scan(TARGET);
  assert.deepEqual(current.map(doc => [doc.name, doc.updateTime]), target.map(doc => [doc.name, doc.updateTime]), 'Dev mudou durante a preparação; execute novamente.');
  const writes = [...desired.map(doc => ({ update: doc })), ...deletions.map(doc => ({ delete: doc.name }))];
  for (let index = 0; index < writes.length; index += 100) {
    const batch = writes.slice(index, index + 100);
    for (const write of batch) assert((write.update?.name || write.delete).startsWith(root(TARGET) + '/'), 'Gravação fora de dev bloqueada.');
    await request(`https://firestore.googleapis.com/v1/projects/${TARGET}/databases/(default)/documents:commit`, 'POST', { writes: batch });
    console.log(`Dev: ${Math.min(index + 100, writes.length)}/${writes.length} operações concluídas.`);
  }
  const actual = await scan(TARGET);
  const normalize = docs => new Map(docs.map(doc => [doc.name, doc.fields || {}]));
  assert.deepEqual(normalize(actual), normalize(desired), 'A verificação dos documentos de dev falhou. Backups preservados.');
  await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ ...plan, verified: true, completedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ verified: true, devDocuments: actual.length, collections: summary(actual), backupDirectory: directory }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
