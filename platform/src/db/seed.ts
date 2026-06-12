import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { runMigrations } from "./migrate.js";

const TEST_USERS = [
  { username: "alice", password: "test1234", displayName: "Alice", skin: "#FF8A80" },
  { username: "bob", password: "test1234", displayName: "Bob", skin: "#80CBC4" },
  { username: "carol", password: "test1234", displayName: "Carol", skin: "#FFD180" },
  { username: "dave", password: "test1234", displayName: "Dave", skin: "#B39DDB" },
];

async function seed(): Promise<void> {
  await runMigrations();

  for (const user of TEST_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const result = await pool.query(
      `
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING
      RETURNING id
      `,
      [user.username, passwordHash],
    );

    if (result.rows.length === 0) {
      console.log(`Skipped existing user: ${user.username}`);
      continue;
    }

    const userId = result.rows[0].id as string;
    await pool.query(
      `
      INSERT INTO player_profiles (user_id, display_name, skin_color)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [userId, user.displayName, user.skin],
    );
    console.log(`Seeded user: ${user.username} / ${user.password}`);
  }
}

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
