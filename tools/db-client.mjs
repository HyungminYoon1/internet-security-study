import pg from 'pg';

export async function database() {
  if (!process.env.STUDY_DATABASE_URL) throw new Error('DATABASE_CREDENTIAL_MISSING');
  const url = new URL(process.env.STUDY_DATABASE_URL);
  if (!/^ep-raspy-moon-aosbozvt(?:-pooler)?\.c-2\.ap-southeast-1\.aws\.neon\.tech$/.test(url.hostname)) throw new Error('DATABASE_HOST_DENIED');
  url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding');
  const client = new pg.Client({connectionString:url.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:20000,statement_timeout:30000});
  client.on('error', () => {});
  await client.connect();
  return client;
}
export function diagnostic(error) {
  // Never emit connection strings, SQL parameters, auth rows or raw provider errors.
  const safeMessage = /^(permission denied|must be owner|role .+ does not exist|function .+ does not exist|relation .+ does not exist|schema .+ does not exist|cannot grant|must have|syntax error)/i.test(error.message || '') && !/postgres|npg_|password|secret|token|@/i.test(error.message);
  console.error('Database operation failed', {code:/^[A-Z0-9_]{3,50}$/.test(error.code || '') ? error.code : 'SANITIZED_ERROR',message:safeMessage ? error.message.slice(0,200) : undefined,position:error.position ? Number(error.position) : undefined,context:/^(SQL|PL\/pgSQL) function [a-z_]+/i.test(error.where || '') ? error.where.split('\n')[0] : undefined});
  process.exitCode = 1;
}
