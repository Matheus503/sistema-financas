// Replace only the DEV Firestore finance data with a synthetic 24-month history.
// Keeps DEV Firebase Auth and group/user/profile documents intact.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const PROJECT = 'sistema-financas-dev';
const ENV_FILE = path.join(process.cwd(), '.env.local');
const root = `projects/${PROJECT}/databases/(default)/documents`;
const categoryNames = ['Moradia', 'Contas da casa', 'Saúde', 'Transporte', 'Mercado', 'Restaurantes', 'Farmácia', 'Lazer', 'Compras', 'Assinaturas', 'Viagem', 'Educação'];
const expenseNotes = {
  Mercado: ['Supermercado', 'Hortifruti', 'Padaria'], Restaurantes: ['Almoço', 'Café', 'Jantar'],
  Transporte: ['Aplicativo de transporte', 'Combustível', 'Estacionamento'], Compras: ['Loja online', 'Casa e decoração', 'Vestuário'],
  Saúde: ['Consulta', 'Exame'], Farmácia: ['Farmácia'], Lazer: ['Cinema', 'Passeio', 'Ingresso'],
  Assinaturas: ['Streaming', 'Armazenamento online'], Viagem: ['Hospedagem', 'Passagem'], Educação: ['Curso', 'Material'],
};
const categories = new Set([...categoryNames, 'Renda extra']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
const money = cents => cents / 100;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function fields(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fields) } };
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fields(item)])) } };
  throw new Error(`Unsupported value type ${typeof value}`);
}
const document = (name, data) => ({ name, fields: fields(data).mapValue.fields });
function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('nullValue' in value) return null;
  return undefined;
}
function makeRng(seedText) {
  let seed = parseInt(hash(seedText).slice(0, 8), 16) || 1;
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const date = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

async function main() {
  const envText = await fs.readFile(ENV_FILE, 'utf8');
  const configuredProject = envText.match(/^NEXT_PUBLIC_FIREBASE_PROJECT_ID\s*=\s*([^\r\n#]+)/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  assert.equal(configuredProject, PROJECT, 'Local environment is not pointed to the expected DEV project.');
  const cliRoot = process.env.FIREBASE_TOOLS_ROOT || path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools');
  const auth = require(path.join(cliRoot, 'lib', 'auth.js'));
  const account = auth.getGlobalDefaultAccount();
  assert(account, 'Sign in with Firebase CLI first.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
  async function request(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Firestore API ${response.status}: ${new URL(url).pathname}`);
    return response.json();
  }
  async function scan() {
    const docs = [];
    let parents = [root];
    while (parents.length) {
      const batch = parents.splice(0, 12);
      const children = await Promise.all(batch.map(async parent => {
        const childDocs = [];
        let page;
        do {
          const list = await request(`https://firestore.googleapis.com/v1/${parent}:listCollectionIds`, 'POST', { pageSize: 1000, ...(page ? { pageToken: page } : {}) });
          for (const collectionId of list.collectionIds || []) {
            let next;
            do {
              const url = new URL(`https://firestore.googleapis.com/v1/${parent}/${encodeURIComponent(collectionId)}`);
              url.searchParams.set('pageSize', '1000'); url.searchParams.set('showMissing', 'true');
              if (next) url.searchParams.set('pageToken', next);
              const found = await request(url);
              for (const item of found.documents || []) {
                if (item.createTime) docs.push(item);
                childDocs.push(item.name);
              }
              next = found.nextPageToken;
            } while (next);
          }
          page = list.nextPageToken;
        } while (page);
        return childDocs;
      }));
      parents.push(...children.flat());
    }
    return docs.sort((a, b) => a.name.localeCompare(b.name));
  }
  const existing = await scan();
  const groups = existing.filter(doc => /^groups\/[^/]+$/.test(doc.name.slice(root.length + 1))).map(doc => ({ id: doc.name.split('/').at(-1), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decode(v)])) }));
  const users = existing.filter(doc => /^users\/[^/]+$/.test(doc.name.slice(root.length + 1))).map(doc => ({ id: doc.name.split('/').at(-1), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decode(v)])) }));
  const activeGroups = groups.map(group => ({ ...group, profiles: users.filter(user => user.groupId === group.id) })).filter(group => group.profiles.length);
  assert(activeGroups.length > 0, 'No DEV groups with profiles were found; refusing to clear finance data.');
  for (const group of activeGroups) assert(group.profiles.some(profile => profile.id === group.ownerUid) || group.profiles.length, `No owner profile for group ${group.id}.`);

  const backupDir = path.join(os.homedir(), '.codex', 'backups', 'sistema-financas', `before-fake-seed-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, 'dev-before.json'), JSON.stringify({ project: PROJECT, documents: existing }));

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthsToSeed = Array.from({ length: 24 }, (_, index) => {
    const value = new Date(currentYear, currentMonth - 1 - 23 + index, 1);
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  });
  const output = [];
  for (const group of activeGroups) {
    const groupId = group.id;
    const ownerId = group.ownerUid || group.profiles[0].id;
    const createdBy = group.profiles.some(profile => profile.id === ownerId) ? ownerId : group.profiles[0].id;
    for (const [order, name] of [...categories].entries()) {
      output.push(document(`${root}/categories/${groupId}_${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, { groupId, name, order, isActive: true }));
    }
    for (const { year, month } of monthsToSeed) {
      const monthId = hash(`${groupId}:${year}-${month}`);
      const monthPath = `${root}/months/${monthId}`;
      const order = year * 12 + month;
      const currentOrder = currentYear * 12 + currentMonth;
      const isPast = order < currentOrder;
      const dayLimit = order === currentOrder ? now.getDate() : new Date(year, month, 0).getDate();
      const rng = makeRng(`${groupId}:${year}:${month}`);
      const accounts = [];
      function addAccount(key, data) {
        const id = hash(`${groupId}:${key}`);
        accounts.push({ id, ...data });
        return id;
      }
      output.push(document(monthPath, { year, month, label: `${year}-${String(month).padStart(2, '0')}`, groupId, createdBy, isClosed: isPast }));
      const receivedDate = date(year, month, Math.min(int(rng, 3, 7), dayLimit));
      const salaryCents = int(rng, 590000, 790000);
      addAccount('salary', { name: 'Salário', type: 'CREDIT', value: money(salaryCents), isPaid: true, paidOn: receivedDate, order: 0 });
      const extraIncomeCents = rng() < 0.48 ? int(rng, 15000, 115000) : 0;
      const extraIncome = money(extraIncomeCents);
      addAccount('extra-income', { name: 'Renda extra', type: 'CREDIT', value: extraIncome, isPaid: extraIncome > 0, ...(extraIncome > 0 ? { paidOn: date(year, month, Math.min(int(rng, 8, 20), dayLimit)) } : {}), order: 1 });
      const fixedTemplates = [
        ['Aluguel', 165000, 195000, 'Moradia'], ['Condomínio', 42000, 59000, 'Moradia'],
        ['Internet', 9900, 13900, 'Contas da casa'], ['Energia', 14500, 33000, 'Contas da casa'],
        ['Plano de saúde', 27000, 34500, 'Saúde'], ['Academia', 7900, 10900, 'Saúde'],
      ];
      let fixedIndex = 2;
      let fixedCents = 0;
      for (const [name, low, high] of fixedTemplates) {
        const valueCents = int(rng, low, high);
        fixedCents += valueCents;
        const value = money(valueCents);
        const paid = isPast || rng() < 0.78;
        addAccount(`fixed:${name}`, { name, type: 'FIXED', value, isPaid: paid, ...(paid ? { paidOn: date(year, month, Math.min(int(rng, 5, 20), dayLimit)) } : {}), order: fixedIndex++, category: name === 'Aluguel' || name === 'Condomínio' ? 'Moradia' : name === 'Plano de saúde' || name === 'Academia' ? 'Saúde' : 'Contas da casa' });
      }
      const cardPaid = isPast || rng() < 0.67;
      const cardId = addAccount('single-credit-card', { name: 'Cartão de crédito principal', type: 'VARIABLE', value: 0, expectedValue: 0, isPaid: cardPaid, ...(cardPaid ? { paidOn: date(year, month, Math.min(int(rng, 12, 25), dayLimit)) } : {}), isCreditCard: true, isPrimaryCreditCard: true, creditCardKey: `card-${hash(groupId).slice(0, 10)}`, dia_fechamento: 12, dia_vencimento: 19, order: 0 });
      const pixId = addAccount('pix', { name: 'PIX', type: 'VARIABLE', value: 0, isPaid: isPast || rng() < 0.75, dia_fechamento: 12, order: 1 });
      const writeAccount = account => {
        const { id, ...data } = account;
        output.push(document(`${monthPath}/accounts/${id}`, data));
      };
      accounts.forEach(writeAccount);
      const totalIncomeCents = salaryCents + extraIncomeCents;
      const surplusTargetCents = int(rng, 70000, 130000);
      const variableBudgetCents = totalIncomeCents - fixedCents - surplusTargetCents;
      assert(variableBudgetCents > 0, `No variable budget for ${groupId} ${year}-${month}.`);
      const pixCount = int(rng, 3, 7);
      const pixCents = Math.floor(variableBudgetCents * (int(rng, 12, 20) / 100));
      const cardCount = int(rng, 13, 25);
      function splitBudget(total, count, minimum) {
        assert(total >= count * minimum, `Budget too small for ${count} transactions.`);
        const weights = Array.from({ length: count }, () => int(rng, 1, 100));
        const remaining = total - count * minimum;
        const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
        const values = weights.map(weight => minimum + Math.floor(remaining * weight / weightTotal));
        for (let i = 0, left = total - values.reduce((sum, value) => sum + value, 0); left > 0; i++, left--) values[i % count]++;
        return values;
      }
      const pixValues = splitBudget(pixCents, pixCount, 1200);
      for (let n = 0; n < pixCount; n++) {
        const category = ['Mercado', 'Transporte', 'Farmácia', 'Restaurantes'][int(rng, 0, 3)];
        const cents = pixValues[n];
        output.push(document(`${monthPath}/transactions/${hash(`${groupId}:${year}-${month}:pix:${n}`)}`, {
          value: money(cents), accountId: pixId, category, note: expenseNotes[category][int(rng, 0, expenseNotes[category].length - 1)], userId: createdBy, userName: 'Dados fictícios', launcherId: createdBy, launcherName: 'Dados fictícios', date: date(year, month, int(rng, 1, dayLimit)),
        }));
      }
      output.splice(output.findIndex(item => item.name === `${monthPath}/accounts/${pixId}`), 1);
      const { id: ignoredPixId, ...pixData } = accounts.find(account => account.id === pixId);
      void ignoredPixId;
      output.push(document(`${monthPath}/accounts/${pixId}`, { ...pixData, value: money(pixCents) }));
      const cardValues = splitBudget(variableBudgetCents - pixCents, cardCount, 500);
      const cardTotalCents = cardValues.reduce((sum, value) => sum + value, 0);
      const cardAccount = accounts.find(account => account.id === cardId);
      cardAccount.value = money(cardTotalCents);
      cardAccount.expectedValue = money(cardTotalCents);
      const pixAccount = accounts.find(account => account.id === pixId);
      pixAccount.value = money(pixCents);
      const monthlySurplusCents = totalIncomeCents - fixedCents - pixCents - cardTotalCents;
      assert(monthlySurplusCents >= 70000, `Expected positive monthly surplus for ${groupId} ${year}-${month}.`);
      for (let n = 0; n < cardCount; n++) {
        const category = categoryNames.filter(name => expenseNotes[name]);
        const selected = category[int(rng, 0, category.length - 1)];
        const cents = cardValues[n];
        output.push(document(`${monthPath}/transactions/${hash(`${groupId}:${year}-${month}:card:${n}`)}`, {
          value: money(cents), accountId: cardId, category: selected, note: expenseNotes[selected][int(rng, 0, expenseNotes[selected].length - 1)], userId: createdBy, userName: 'Dados fictícios', launcherId: createdBy, launcherName: 'Dados fictícios', date: date(year, month, int(rng, 1, dayLimit)),
        }));
      }
    }
  }

  const targetPaths = new Set(output.map(item => item.name));
  assert.equal(targetPaths.size, output.length, 'Generated duplicate document IDs; aborting.');
  const businessCollections = new Set(['months', 'categories', 'installmentPurchases']);
  const oldFinance = existing.filter(doc => businessCollections.has(doc.name.slice(root.length + 1).split('/')[0]));
  const summary = { project: PROJECT, groups: activeGroups.length, monthsPerGroup: 24, start: `${monthsToSeed[0].year}-${String(monthsToSeed[0].month).padStart(2, '0')}`, end: `${monthsToSeed.at(-1).year}-${String(monthsToSeed.at(-1).month).padStart(2, '0')}`, previousFinanceDocuments: oldFinance.length, newDocuments: output.length, backupDir };
  await fs.writeFile(path.join(backupDir, 'seed-plan.json'), JSON.stringify(summary, null, 2));

  // Confirm dev did not change while the fake dataset was being prepared.
  const latest = await scan();
  assert.deepEqual(latest.map(doc => [doc.name, doc.updateTime]), existing.map(doc => [doc.name, doc.updateTime]), 'DEV changed during preparation; aborting before deletion.');
  const writes = [
    ...oldFinance.filter(doc => !targetPaths.has(doc.name)).map(doc => ({ delete: doc.name })),
    ...output.map(item => ({ update: item })),
  ];
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = writes.slice(offset, offset + 400);
    for (const write of batch) assert((write.update?.name || write.delete).startsWith(`${root}/`), 'Write outside DEV blocked.');
    await request(`https://firestore.googleapis.com/v1/${root}:commit`, 'POST', { writes: batch });
    console.log(`DEV seed ${Math.min(offset + batch.length, writes.length)}/${writes.length}`);
  }
  const finalDocs = await scan();
  const finalFinance = finalDocs.filter(doc => businessCollections.has(doc.name.slice(root.length + 1).split('/')[0]));
  const expected = new Map(output.map(item => [item.name, JSON.stringify(canonical(item.fields))]));
  assert.equal(finalFinance.length, output.length, 'DEV finance document count did not match the generated data.');
  assert(finalFinance.every(item => expected.get(item.name) === JSON.stringify(canonical(item.fields))), 'DEV verification did not match the generated seed.');
  const linkedGroups = new Set(finalFinance.filter(doc => doc.name.includes('/months/') && /^months\/[^/]+$/.test(doc.name.slice(root.length + 1))).map(doc => decode(doc.fields.groupId)));
  assert.equal(linkedGroups.size, activeGroups.length);
  await fs.writeFile(path.join(backupDir, 'seed-result.json'), JSON.stringify({ ...summary, verified: true, financeDocuments: finalFinance.length, completedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ ...summary, verified: true, financeDocuments: finalFinance.length }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
