export function validateEnvironment(): void {
  const required = [
    "AZURE_CLIENT_ID",
    "AZURE_TENANT_ID",
    "AZURE_CLIENT_SECRET",
    "SENDER_EMAIL",
    "ADMIN_EMAIL",
    "CC_EMAIL",
  ];

  const missing = required.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}
