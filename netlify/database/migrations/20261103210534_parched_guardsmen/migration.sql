CREATE TABLE "account" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" serial PRIMARY KEY,
	"name" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"about" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"category_id" text,
	"price" numeric(10,2) NOT NULL,
	"description" text,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;