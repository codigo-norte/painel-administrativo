/// <reference types="node" />

import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.env')) {
  loadEnvFile('.env')
}

const databaseUrl = process.env.NETLIFY_DB_URL
if (!databaseUrl) {
  throw new Error('Defina NETLIFY_DB_URL no arquivo .env antes de usar o Drizzle Kit.')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: 'netlify/database/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
})
