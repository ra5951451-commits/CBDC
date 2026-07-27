/**
 * seed.js — One-time script to populate Upstash Redis from data.json.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your Upstash credentials + JWT_SECRET
 *   2. Run: node scripts/seed.js
 *
 * This script:
 *   - Creates the Talati user record with bcrypt-hashed password
 *   - Stores all 270 beneficiaries as individual Redis keys
 *   - Creates the beneficiaries:all set
 *   - Stores app metadata
 */

const path = require('path');
const fs = require('fs');

// ── Load environment variables from .env file ────────────────────────────────
// Simple .env loader (no dotenv dependency needed for a one-off script)
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at', envPath);
    console.error('   Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// Now require modules that need env vars
const { Redis } = require('@upstash/redis');
const bcrypt = require('bcryptjs');

// ── Config ───────────────────────────────────────────────────────────────────

const DATA_PATH = path.resolve(__dirname, '..', 'assets', 'data', 'data.json');
const SALT_ROUNDS = 10;

const USER = {
  id: 'talati_001',
  username: 'nikunjdarji',
  password: 'Nikunj@97',  // Will be hashed before storage
  role: 'talati',
  district: 'મહેસાણા',
  taluka: 'ઊંઝા',
  createdAt: new Date().toISOString(),
};

// ── Main Seed Function ───────────────────────────────────────────────────────

async function seed() {
  console.log('');
  console.log('🌱 Talati Onboarding System — Redis Seed Script');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Validate env
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env');
    process.exit(1);
  }

  console.log(`📡 Redis URL: ${url.slice(0, 30)}...`);

  const redis = new Redis({ url, token });

  // ── 1. Load data.json ────────────────────────────────────────────────────
  console.log('');
  console.log('📂 Loading data.json...');

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ data.json not found at ${DATA_PATH}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const metadata = rawData.metadata;
  const beneficiaries = rawData.beneficiaries;

  console.log(`   Found ${beneficiaries.length} beneficiaries`);
  console.log(`   District: ${metadata.district}, Taluka: ${metadata.taluka}`);
  console.log(`   Generated: ${metadata.generated_on}`);

  // ── 2. Create user ──────────────────────────────────────────────────────
  console.log('');
  console.log('👤 Creating Talati user...');

  const passwordHash = await bcrypt.hash(USER.password, SALT_ROUNDS);

  const userRecord = {
    id: USER.id,
    username: USER.username,
    passwordHash,
    role: USER.role,
    district: USER.district,
    taluka: USER.taluka,
    createdAt: USER.createdAt,
  };

  await redis.set(`user:${USER.id}`, JSON.stringify(userRecord));
  await redis.set(`user:login:${USER.username}`, JSON.stringify(USER.id));

  console.log(`   ✅ User created: ${USER.username} (${USER.id})`);
  console.log(`   ✅ Login index: user:login:${USER.username} → ${USER.id}`);

  // ── 3. Store metadata ──────────────────────────────────────────────────
  console.log('');
  console.log('📋 Storing app metadata...');

  await redis.set('metadata:app', JSON.stringify(metadata));
  console.log('   ✅ Metadata stored at metadata:app');

  // ── 4. Store beneficiaries ─────────────────────────────────────────────
  console.log('');
  console.log(`📝 Storing ${beneficiaries.length} beneficiaries...`);

  let storedCount = 0;
  const srNos = [];

  for (const b of beneficiaries) {
    const record = {
      sr_no: b.sr_no,
      name: b.name,
      ration_card: b.ration_card,
      clean_ration_card: b.clean_ration_card,
      card_type: b.card_type,
      shop_name: b.shop_name,
      area_name: b.area_name,
      mobile: b.mobile,
      member_id: b.member_id,
      uid_masked: b.uid_masked,
      onboarded: b.onboarded,
      rc_onboarded: b.rc_onboarded,
    };

    await redis.set(`beneficiary:${b.sr_no}`, JSON.stringify(record));
    srNos.push(String(b.sr_no));
    storedCount++;

    // Progress indicator every 50 records
    if (storedCount % 50 === 0) {
      console.log(`   ... ${storedCount}/${beneficiaries.length} stored`);
    }
  }

  console.log(`   ✅ ${storedCount} beneficiaries stored`);

  // ── 5. Create beneficiaries:all set ────────────────────────────────────
  console.log('');
  console.log('📌 Creating beneficiaries:all set...');

  // Add in batches to avoid argument limits
  const batchSize = 50;
  for (let i = 0; i < srNos.length; i += batchSize) {
    const batch = srNos.slice(i, i + batchSize);
    await redis.sadd('beneficiaries:all', ...batch);
  }

  console.log(`   ✅ Set created with ${srNos.length} members`);

  // ── 6. Summary ─────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('   Redis keys created:');
  console.log(`   • user:${USER.id} — Talati user profile`);
  console.log(`   • user:login:${USER.username} — login index`);
  console.log(`   • metadata:app — app metadata`);
  console.log(`   • beneficiary:1 through beneficiary:${beneficiaries.length} — individual records`);
  console.log(`   • beneficiaries:all — set of all sr_no values`);
  console.log('');
  console.log(`   Total keys: ${3 + beneficiaries.length + 1}`);
  console.log('');
  console.log('   You can now deploy and login with:');
  console.log(`   Username: ${USER.username}`);
  console.log(`   Password: ${USER.password}`);
  console.log('');
}

// ── Run ──────────────────────────────────────────────────────────────────────

seed().catch(err => {
  console.error('');
  console.error('❌ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
