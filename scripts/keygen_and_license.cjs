const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEYS_DIR = path.join(__dirname, "keys");
const MASTER_KEY_FILE = path.join(KEYS_DIR, "license_master.json");

function ensureKeysDir() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
}

function base64UrlEncode(buf) {
  return buf.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function initKeypair() {
  ensureKeysDir();
  if (fs.existsSync(MASTER_KEY_FILE)) {
    const existing = JSON.parse(fs.readFileSync(MASTER_KEY_FILE, "utf8"));
    console.log("Master keypair already exists at:", MASTER_KEY_FILE);
    printKeys(existing);
    return existing;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ type: "spki", format: "der" });
  const rawPub = pubDer.subarray(pubDer.length - 32);

  const privDer = privateKey.export({ type: "pkcs8", format: "der" });
  const rawPriv = privDer.subarray(privDer.length - 32);

  const keyData = {
    publicKeyHex: rawPub.toString("hex"),
    privateKeyHex: rawPriv.toString("hex"),
    publicKeyBase64: rawPub.toString("base64"),
    privateKeyBase64: rawPriv.toString("base64"),
    publicKeyDerBase64: pubDer.toString("base64"),
    privateKeyDerBase64: privDer.toString("base64"),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(MASTER_KEY_FILE, JSON.stringify(keyData, null, 2), "utf8");
  console.log("Generated brand new Ed25519 Master License Keypair at:", MASTER_KEY_FILE);
  printKeys(keyData);
  return keyData;
}

function printKeys(keyData) {
  const bytes = Buffer.from(keyData.publicKeyHex, "hex");
  const rustArray = Array.from(bytes).map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(", ");
  console.log("\n=======================================================");
  console.log("ALTSPACE ED25519 PUBLIC KEY (Embed in Rust Binary):");
  console.log(`Hex: ${keyData.publicKeyHex}`);
  console.log(`Rust byte array: [${rustArray}]`);
  console.log("=======================================================\n");
}

function getMasterKeypair() {
  if (!fs.existsSync(MASTER_KEY_FILE)) {
    return initKeypair();
  }
  return JSON.parse(fs.readFileSync(MASTER_KEY_FILE, "utf8"));
}

function issueLicense({ user, email, machine = "ANY", tier = "Pro", days = 0 }) {
  if (!user) {
    throw new Error("Missing required argument: --user <username>");
  }

  const keyData = getMasterKeypair();
  const privKey = crypto.createPrivateKey({
    key: Buffer.from(keyData.privateKeyDerBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = days > 0 ? nowSec + days * 86400 : 0;
  const idSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();

  const payload = {
    v: 1,
    id: `ALTS-${idSuffix}`,
    user: String(user).trim(),
    email: email ? String(email).trim() : undefined,
    tier: String(tier).trim(),
    machine: String(machine).trim(),
    iat: nowSec,
    exp: expSec,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBuf = Buffer.from(payloadJson, "utf8");
  const signature = crypto.sign(null, payloadBuf, privKey);

  const token = `ALTS1-${base64UrlEncode(payloadBuf)}.${base64UrlEncode(signature)}`;
  return { token, payload };
}

function verifyLicense(licenseString, currentMachineId = null) {
  const keyData = getMasterKeypair();
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(keyData.publicKeyDerBase64, "base64"),
    format: "der",
    type: "spki",
  });

  if (!licenseString.startsWith("ALTS1-")) {
    throw new Error("Invalid license key prefix. Expected ALTS1-...");
  }

  const rest = licenseString.slice("ALTS1-".length);
  const parts = rest.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed license key format. Expected ALTS1-<payload>.<signature>");
  }

  const payloadBuf = base64UrlDecode(parts[0]);
  const sigBuf = base64UrlDecode(parts[1]);

  const isValid = crypto.verify(null, payloadBuf, pubKey, sigBuf);
  if (!isValid) {
    throw new Error("Cryptographic verification failed: Invalid Ed25519 signature!");
  }

  const payload = JSON.parse(payloadBuf.toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp > 0 && payload.exp < now) {
    throw new Error(`License key expired on ${new Date(payload.exp * 1000).toISOString()}`);
  }

  if (payload.machine && payload.machine !== "ANY" && currentMachineId) {
    if (payload.machine.toLowerCase() !== currentMachineId.toLowerCase()) {
      throw new Error(`License key is locked to machine ${payload.machine}, but current machine is ${currentMachineId}`);
    }
  }

  return { valid: true, payload };
}

// CLI handler
const args = process.argv.slice(2);
const command = args[0] || "help";

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

if (command === "init") {
  initKeypair();
} else if (command === "issue") {
  const user = getArg("--user");
  const email = getArg("--email");
  const machine = getArg("--machine") || "ANY";
  const tier = getArg("--tier") || "Pro";
  const days = parseInt(getArg("--days") || "0", 10);

  const { token, payload } = issueLicense({ user, email, machine, tier, days });
  console.log("\n=======================================================");
  console.log("ALTSPACE CRYPTOGRAPHIC LICENSE ISSUED SUCCESSFULLY:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("\nLICENSE KEY:");
  console.log(token);
  console.log("=======================================================\n");
} else if (command === "verify") {
  const key = args[1];
  const machine = getArg("--machine");
  if (!key) {
    console.error("Usage: node scripts/keygen_and_license.cjs verify <license_key> [--machine <id>]");
    process.exit(1);
  }
  try {
    const res = verifyLicense(key, machine);
    console.log("License is VALID:", JSON.stringify(res.payload, null, 2));
  } catch (err) {
    console.error("License is INVALID:", err.message);
    process.exit(1);
  }
} else {
  console.log(`
AltSpace Cryptographic License Tool
Commands:
  node scripts/keygen_and_license.cjs init
  node scripts/keygen_and_license.cjs issue --user <name> [--email <email>] [--machine <id>] [--tier Pro] [--days 0]
  node scripts/keygen_and_license.cjs verify <key> [--machine <id>]
`);
}

module.exports = {
  initKeypair,
  getMasterKeypair,
  issueLicense,
  verifyLicense,
};
