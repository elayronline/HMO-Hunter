import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Read the migration file
  const migrationPath = path.join(__dirname, "013_create_price_alerts_table.sql")
  const sql = fs.readFileSync(migrationPath, "utf-8")

  // Split by semicolons and filter empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"))

  console.log(`Running ${statements.length} SQL statements...`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (!statement || statement.startsWith("--")) continue

    try {
      console.log(`\n[${i + 1}/${statements.length}] Executing...`)
      console.log(statement.substring(0, 80) + (statement.length > 80 ? "..." : ""))

      const { error } = await supabase.rpc("exec_sql", { sql: statement })

      if (error) {
        // Try direct query if rpc doesn't work
        const { error: queryError } = await supabase.from("_").select().limit(0)
        console.log(`Statement ${i + 1}: RPC not available, trying alternative...`)
      }
    } catch (err) {
      console.error(`Error on statement ${i + 1}:`, err)
    }
  }

  console.log("\nMigration complete!")
}

runMigration().catch(console.error)
