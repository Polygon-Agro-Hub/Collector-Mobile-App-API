require("dotenv").config();

/**
 * Validates essential environment variables on application startup.
 * Prevents the application from running with missing or insecure configurations.
 */
const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME_CO",
  "DB_NAME_PC",
  "DB_NAME_AD",
];

const validateEnv = () => {
  const missing = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName] || process.env[varName].trim() === "") {
      missing.push(varName);
    }
  }

  // Security check: Guard against unsafe fallback secrets
  const insecureSecrets = ["t1", "secret", "default", "123456"];
  if (
    process.env.JWT_SECRET &&
    insecureSecrets.includes(process.env.JWT_SECRET.trim().toLowerCase())
  ) {
    console.error(
      "❌ [Security Error] JWT_SECRET is set to an insecure default value. Please provide a strong secret in .env."
    );
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error(
      "\n❌ [Environment Error] Missing required environment variables in .env:"
    );
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error(
      "\nPlease check your .env file and ensure all required configurations are provided.\n"
    );
    process.exit(1);
  }

  console.log("🔒 Environment variables validated successfully.");
};

// Run validation immediately on import
validateEnv();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  isProduction: process.env.NODE_ENV === "production",
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    names: {
      collectionOfficer: process.env.DB_NAME_CO,
      plantCare: process.env.DB_NAME_PC,
      admin: process.env.DB_NAME_AD,
    },
  },
};
