import { asc, eq } from "drizzle-orm";
import { account, company } from "../../../db/schema";
import { getDb } from "./db";

export const emptyCompany = {
  name: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  about: "",
};

export const emptyAccount = {
  name: "Administrador",
  email: "",
};

export async function readCompany() {
  const [record] = await getDb()
    .select()
    .from(company)
    .orderBy(asc(company.id))
    .limit(1);
  if (!record) return emptyCompany;
  return {
    name: record.name,
    website: record.website,
    email: record.email,
    phone: record.phone,
    address: record.address,
    about: record.about,
  };
}

export async function writeCompany(values: typeof emptyCompany) {
  const db = getDb();
  const [existing] = await db
    .select({ id: company.id })
    .from(company)
    .orderBy(asc(company.id))
    .limit(1);

  if (existing) {
    await db.update(company).set(values).where(eq(company.id, existing.id));
    return values;
  }

  await db
    .insert(company)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: company.id, set: values });
  return values;
}

export async function readAccount() {
  const [record] = await getDb()
    .select()
    .from(account)
    .orderBy(asc(account.id))
    .limit(1);
  if (!record) return emptyAccount;
  return { name: record.name, email: record.email };
}

export async function writeAccount(values: typeof emptyAccount) {
  const db = getDb();
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .orderBy(asc(account.id))
    .limit(1);

  if (existing) {
    await db.update(account).set(values).where(eq(account.id, existing.id));
    return values;
  }

  await db
    .insert(account)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: account.id, set: values });
  return values;
}
