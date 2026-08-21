// Load local .env file if it exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const token = process.env.RENDER_API_KEY;
const ownerId = "tea-d9p3jgfavr4c73aift00";
const environmentId = "evm-da4216gjo6nc73dg6igg";
const repoUrl = "https://github.com/Nseconds/image-to-3d-automation.git";
const branchName = "main";
const openRouterKey = process.env.OPENROUTER_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!token) {
  console.error("Error: RENDER_API_KEY is not set. Please set it in a local .env file or environment variables.");
  process.exit(1);
}
if (!openRouterKey) {
  console.error("Error: OPENROUTER_API_KEY is not set. Please set it in a local .env file or environment variables.");
  process.exit(1);
}
if (!geminiKey) {
  console.error("Error: GEMINI_API_KEY is not set. Please set it in a local .env file or environment variables.");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json",
  "Accept": "application/json"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, method = "GET", body = null) {
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${url}: ${text}`);
  }
  return res.json();
}

async function getOrCreatePostgres() {
  console.log("Checking for existing PostgreSQL database...");
  const list = await request("https://api.render.com/v1/postgres?limit=20");
  let db = list.find(d => d.postgres.name === "3d-postgres-db" && d.postgres.environmentId === environmentId);
  
  if (db) {
    console.log(`Found existing database with ID: ${db.postgres.id}`);
    return db.postgres;
  }
  
  console.log("Database not found. Creating a new one...");
  const payload = {
    name: "3d-postgres-db",
    ownerId,
    environmentId,
    plan: "free",
    region: "oregon",
    version: "15"
  };
  
  const res = await request("https://api.render.com/v1/postgres", "POST", payload);
  console.log(`Triggered creation of database with ID: ${res.id}`);
  return res;
}

async function waitForPostgresActive(dbId) {
  console.log("Waiting for PostgreSQL database to become active...");
  while (true) {
    const res = await request(`https://api.render.com/v1/postgres/${dbId}`);
    console.log(`Database status: ${res.status}`);
    if (res.status === "available" || res.status === "active") {
      break;
    }
    if (res.status === "failed") {
      throw new Error("PostgreSQL database creation failed on Render.");
    }
    await sleep(5000);
  }
  console.log("Database is active!");
}

async function getPostgresConnectionInfo(dbId) {
  console.log("Fetching database connection info...");
  const res = await request(`https://api.render.com/v1/postgres/${dbId}/connection-info`);
  
  // Extract host, user, password, database from internalConnectionString
  // Format: postgresql://user:password@internal-host:5432/dbname
  const url = res.internalConnectionString;
  const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+)(?::\d+)?\/(.+)/);
  if (!matches) {
    throw new Error(`Failed to parse internal connection string: ${url}`);
  }
  
  return {
    user: matches[1],
    password: matches[2],
    host: matches[3],
    database: matches[4]
  };
}

async function createWebService(name, context, dockerfile, envVars = []) {
  console.log(`Checking for existing service: ${name}...`);
  const list = await request("https://api.render.com/v1/services?limit=20");
  let svc = list.find(s => s.service.name === name && s.service.environmentId === environmentId);
  
  if (svc) {
    console.log(`Service ${name} already exists with ID: ${svc.service.id}`);
    return svc.service;
  }
  
  console.log(`Creating service: ${name}...`);
  const payload = {
    type: "web_service",
    name,
    ownerId,
    environmentId,
    repo: repoUrl,
    branch: branchName,
    serviceDetails: {
      env: "docker",
      dockerContext: context,
      dockerfilePath: `${context}/${dockerfile}`,
      plan: "free",
      region: "oregon"
    },
    envVars
  };
  
  const res = await request("https://api.render.com/v1/services", "POST", payload);
  console.log(`Created service ${name} with ID: ${res.id}`);
  return res;
}

async function createImageWebService(name, imagePath, envVars = []) {
  console.log(`Checking for existing image service: ${name}...`);
  const list = await request("https://api.render.com/v1/services?limit=20");
  let svc = list.find(s => s.service.name === name && s.service.environmentId === environmentId);
  
  if (svc) {
    console.log(`Service ${name} already exists with ID: ${svc.service.id}`);
    return svc.service;
  }
  
  console.log(`Creating image service: ${name} (Image: ${imagePath})...`);
  const payload = {
    type: "web_service",
    name,
    ownerId,
    environmentId,
    image: {
      imagePath
    },
    serviceDetails: {
      env: "image",
      plan: "free",
      region: "oregon"
    },
    envVars
  };
  
  const res = await request("https://api.render.com/v1/services", "POST", payload);
  console.log(`Created image service ${name} with ID: ${res.id}`);
  return res;
}

async function main() {
  console.log("=== STARTING DEPLOYMENT TO RENDER ===");
  try {
    // 1. Get or Create Postgres
    const db = await getOrCreatePostgres();
    await waitForPostgresActive(db.id);
    const dbInfo = await getPostgresConnectionInfo(db.id);
    
    // 2. Create FastAPI Asset Processor
    console.log("\nDeploying FastAPI Asset Processor...");
    await createWebService("3d-asset-processor", "asset-processor", "Dockerfile", [
      { key: "PORT", value: "8000" },
      { key: "REMBG_MODEL", value: "u2net_thin" }
    ]);
    
    // 3. Create Puppeteer Automation Service
    console.log("\nDeploying Puppeteer Automation Service...");
    await createWebService("3d-automation-service", "automation-service", "Dockerfile", [
      { key: "PORT", value: "10000" }
    ]);
    
    // 4. Create n8n Server
    console.log("\nDeploying n8n server from prebuilt Docker image...");
    const n8nSvc = await createImageWebService("3d-n8n-server", "docker.io/n8nio/n8n:latest", [
      { key: "PORT", value: "5678" },
      { key: "DB_TYPE", value: "postgresdb" },
      { key: "DB_POSTGRESDB_HOST", value: dbInfo.host },
      { key: "DB_POSTGRESDB_PORT", value: "5432" },
      { key: "DB_POSTGRESDB_DATABASE", value: dbInfo.database },
      { key: "DB_POSTGRESDB_USER", value: dbInfo.user },
      { key: "DB_POSTGRESDB_PASSWORD", value: dbInfo.password },
      { key: "N8N_ENCRYPTION_KEY", value: "n8n-encryption-key-for-prompt-to-3d-automation" },
      { key: "OPENROUTER_API_KEY", value: openRouterKey },
      { key: "GEMINI_API_KEY", value: geminiKey }
    ]);
    
    // 5. Create Next.js Frontend
    console.log("\nDeploying Next.js frontend...");
    const n8nPublicUrl = n8nSvc.serviceDetails.url; // e.g. https://3d-n8n-server.onrender.com
    const webhookUrl = `${n8nPublicUrl}/webhook/generate-3d-asset`;
    console.log(`Setting NEXT_PUBLIC_N8N_WEBHOOK_URL to: ${webhookUrl}`);
    
    await createWebService("3d-asset-frontend", "frontend", "Dockerfile", [
      { key: "NEXT_PUBLIC_N8N_WEBHOOK_URL", value: webhookUrl }
    ]);
    
    console.log("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY! ===");
    console.log("All services have been created and wired up in Render!");
  } catch (err) {
    console.error("\nDeployment failed with error:", err.message);
    process.exit(1);
  }
}

main();
