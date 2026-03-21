#!/usr/bin/env tsx
/**
 * Database Migration Runner for Enterprise Authentication System
 * Run with: tsx server/src/scripts/run-migration.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { databaseService } from '../services/DatabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Enterprise Auth System Migration...');

  try {
    // Initialize database connection
    await databaseService.initialize();
    console.log('✅ Database connection established');

    // Read migration SQL file
    const migrationPath = resolve(__dirname, '../migrations/001_enterprise_auth_setup.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('📄 Migration SQL loaded');

    // Execute migration
    await databaseService.query(migrationSQL);
    console.log('✅ Migration executed successfully');

    // Verify tables were created
    const tables = await databaseService.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'refresh_tokens', 'audit_logs')
      ORDER BY table_name;
    `);

    console.log('📊 Verification - Created tables:', tables.rows.map(r => r.table_name));

    // Check if documents table was extended
    const documentsColumns = await databaseService.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'documents'
        AND column_name IN ('owner_id', 'department', 'classification', 'allowed_roles', 'allowed_users')
      ORDER BY column_name;
    `);

    console.log('📊 Verification - Documents table extensions:');
    documentsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check RLS status
    const rlsStatus = await databaseService.query(`
      SELECT schemaname, tablename, rowsecurity
      FROM pg_tables
      WHERE tablename = 'documents' AND schemaname = 'public';
    `);

    const rlsEnabled = rlsStatus.rows[0]?.rowsecurity;
    console.log(`📊 Verification - Row Level Security on documents: ${rlsEnabled ? '✅ Enabled' : '❌ Disabled'}`);

    // Check policies
    const policies = await databaseService.query(`
      SELECT policyname, tablename, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'documents'
      ORDER BY policyname;
    `);

    console.log('📊 Verification - RLS Policies:', policies.rows.length, 'policies created');
    policies.rows.forEach(policy => {
      console.log(`  - ${policy.policyname}: ${policy.cmd} for ${policy.roles || 'public'}`);
    });

    // Test default admin user
    const adminUser = await databaseService.query(`
      SELECT id, email, name, role, department, is_active
      FROM users
      WHERE email = 'admin@cor7ex.local';
    `);

    if (adminUser.rows.length > 0) {
      console.log('👤 Default admin user created:', {
        id: adminUser.rows[0].id,
        email: adminUser.rows[0].email,
        role: adminUser.rows[0].role,
        department: adminUser.rows[0].department,
        active: adminUser.rows[0].is_active
      });
    }

    console.log('🎉 Enterprise Auth System Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await databaseService.close();
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration };