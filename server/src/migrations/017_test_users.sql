-- Migration 017: Test users for development/testing
-- Creates users with different roles to test permission system

-- Employee user (limited document access: public + internal only)
INSERT INTO users (email, name, role, department, provider, provider_id)
VALUES (
    'test.employee@cor7ex.local',
    'Test Mitarbeiter',
    'Employee',
    'Vertrieb',
    'microsoft',
    'dev-test-employee-001'
) ON CONFLICT (email) DO NOTHING;

-- Manager user (extended document access: public + internal + confidential)
INSERT INTO users (email, name, role, department, provider, provider_id)
VALUES (
    'test.manager@cor7ex.local',
    'Test Manager',
    'Manager',
    'Vertrieb',
    'microsoft',
    'dev-test-manager-001'
) ON CONFLICT (email) DO NOTHING;
