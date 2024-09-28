// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./0000_left_daredevil.sql";
import m0001 from "./0001_steep_blue_blade.sql";
import m0002 from "./0002_boring_gunslinger.sql";
import journal from "./meta/_journal.json";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
  },
};
