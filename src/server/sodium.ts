import { createRequire } from "module";

const require = createRequire(import.meta.url);
// require() uses package.json "require" → CJS build (avoids ESM libsodium.mjs); keep in serverExternalPackages
const sodium = require("libsodium-wrappers");

export async function generateSodiumKey(secret: string, key: string) {
  try {
    await sodium.ready;

    // Convert the secret and key to a Uint8Array.
    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(secret);

    // Encrypt the secret using libsodium
    const encBytes = sodium.crypto_box_seal(binsec, binkey);

    // Convert the encrypted Uint8Array to Base64
    const output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

    return output;
  } catch (error) {
    console.error("Error generating sodium key:", error);
    return null;
  }
}
