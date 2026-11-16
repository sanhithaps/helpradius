const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function migrate() {
  if (!fs.existsSync(USERS_FILE)) {
    console.log('[MIGRATION] No users.json file found to migrate.');
    return;
  }

  console.log('[MIGRATION] Reading users.json...');
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  let userEntries = [];
  try {
    userEntries = JSON.parse(raw);
  } catch (err) {
    console.error('[MIGRATION] Failed to parse users.json:', err.message);
    return;
  }

  let migratedPasswords = 0;
  let maskedIds = 0;

  const migratedEntries = userEntries.map(([id, user]) => {
    const updated = { ...user };

    // 1. Password migration: Hash plain text passwords with bcrypt
    if (updated.password && !updated.passwordHash) {
      updated.passwordHash = bcrypt.hashSync(updated.password, 10);
      delete updated.password;
      migratedPasswords++;
    } else if (updated.password) {
      delete updated.password;
    }

    // 2. Identity privacy migration: Mask full ID numbers, keep only last 4
    if (updated.verificationId) {
      const clean = String(updated.verificationId).replace(/[^a-zA-Z0-9]/g, '');
      const last4 = clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, 'X');
      updated.idLast4 = `XXXX-XXXX-${last4}`;
      updated.idVerified = Boolean(updated.idVerified);
      delete updated.verificationId;
      maskedIds++;
    } else if (!updated.idLast4) {
      updated.idLast4 = 'XXXX-XXXX-0000';
    }

    return [id, updated];
  });

  // Atomic write back
  const tempPath = `${USERS_FILE}.tmp_${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(migratedEntries, null, 2), 'utf8');
  fs.renameSync(tempPath, USERS_FILE);

  console.log(`[MIGRATION COMPLETE]`);
  console.log(`- Passwords migrated to bcrypt hashes: ${migratedPasswords}`);
  console.log(`- Sensitive ID numbers masked: ${maskedIds}`);
  console.log(`- Total users processed: ${migratedEntries.length}`);
}

migrate();
