/**
 * Database Backend Configuration
 * 
 * This module provides a centralized way to configure which database backend to use.
 * Set USE_SUPABASE=true in environment to use Supabase PostgreSQL,
 * or USE_SUPABASE=false to continue using DynamoDB.
 * 
 * Default is true (Supabase) for the migration.
 */

export const USE_SUPABASE = process.env.USE_SUPABASE !== 'false';

export const getDatabaseBackend = () => {
  return USE_SUPABASE ? 'supabase' : 'dynamodb';
};

console.log(`[Database] Using ${getDatabaseBackend()} backend`);
