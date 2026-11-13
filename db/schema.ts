
import {
  pgTable,
  text,
  numeric,
  serial,
  date,
  integer,
} from 'drizzle-orm/pg-core'

// Tabela de categorias
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

// Tabela de produtos
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  status: text('status').notNull(),
})

// Tabela de informações da empresa
export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default(''),
  website: text('website').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  about: text('about').notNull().default(''),
})

// Tabela da conta administrativa
export const account = pgTable('account', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
})

export const siteVisits = pgTable('site_visits', {
  visitDate: date('visit_date', { mode: 'string' }).primaryKey(),
  visits: integer('visits').notNull().default(0),
})
