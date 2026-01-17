#!/usr/bin/env node
/**
 * Verify that dist folder contains all required files for Chrome extension
 * This script checks:
 * - Required files exist
 * - manifest.json is valid and references exist
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionRoot = resolve(__dirname, "..");
const distDir = resolve(extensionRoot, "dist");

let hasError = false;

function checkFile(filePath, description) {
  if (existsSync(filePath)) {
    console.log(`✓ ${description}: ${filePath}`);
    return true;
  } else {
    console.error(`✗ ${description} not found: ${filePath}`);
    hasError = true;
    return false;
  }
}

function checkManifestReference(manifest, key, expectedValue, description) {
  const keys = key.split(".");
  let value = manifest;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      console.error(`✗ ${description}: ${key} not found in manifest.json`);
      hasError = true;
      return false;
    }
  }

  if (value === expectedValue || (Array.isArray(value) && value.includes(expectedValue))) {
    console.log(`✓ ${description}: ${key} = ${JSON.stringify(value)}`);
    return true;
  } else {
    console.error(`✗ ${description}: ${key} = ${JSON.stringify(value)}, expected ${JSON.stringify(expectedValue)}`);
    hasError = true;
    return false;
  }
}

console.log("🔍 Verifying dist folder...\n");

// Check required files exist
console.log("Checking required files:");
checkFile(resolve(distDir, "manifest.json"), "manifest.json");
checkFile(resolve(distDir, "popup.html"), "popup.html");
checkFile(resolve(distDir, "popup.js"), "popup.js");
checkFile(resolve(distDir, "background.js"), "background.js");
checkFile(resolve(distDir, "contentScript.js"), "contentScript.js");

console.log("\nChecking manifest.json structure:");

// Read and parse manifest.json
let manifest;
try {
  const manifestPath = resolve(distDir, "manifest.json");
  const manifestContent = readFileSync(manifestPath, "utf-8");
  manifest = JSON.parse(manifestContent);
} catch (err) {
  console.error(`✗ Failed to read/parse manifest.json: ${err.message}`);
  process.exit(1);
}

// Check manifest_version
if (manifest.manifest_version === 3) {
  console.log(`✓ manifest_version = 3`);
} else {
  console.error(`✗ manifest_version = ${manifest.manifest_version}, expected 3`);
  hasError = true;
}

// Check background.service_worker
checkManifestReference(manifest, "background.service_worker", "background.js", "background.service_worker");

// Check action.default_popup
checkManifestReference(manifest, "action.default_popup", "popup.html", "action.default_popup");

// Check content_scripts[0].js
if (manifest.content_scripts && Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) {
  const contentScript = manifest.content_scripts[0];
  const jsFiles = contentScript.js;
  if (Array.isArray(jsFiles) && jsFiles.includes("contentScript.js")) {
    console.log(`✓ content_scripts[0].js includes "contentScript.js"`);
    // Verify the file exists
    checkFile(resolve(distDir, "contentScript.js"), "contentScript.js (referenced in manifest)");
  } else {
    console.error(`✗ content_scripts[0].js = ${JSON.stringify(jsFiles)}, expected to include "contentScript.js"`);
    hasError = true;
  }
  
  // Check content_scripts[0].matches includes amazon.co.jp
  if (contentScript.matches && Array.isArray(contentScript.matches)) {
    const hasAmazonCoJp = contentScript.matches.some(m => m.includes("amazon.co.jp"));
    if (hasAmazonCoJp) {
      console.log(`✓ content_scripts[0].matches includes "amazon.co.jp"`);
    } else {
      console.error(`✗ content_scripts[0].matches does not include "amazon.co.jp": ${JSON.stringify(contentScript.matches)}`);
      hasError = true;
    }
  } else {
    console.error(`✗ content_scripts[0].matches not found or not an array`);
    hasError = true;
  }
  
  // Check content_scripts[0].run_at
  if (contentScript.run_at === "document_start") {
    console.log(`✓ content_scripts[0].run_at = "document_start"`);
  } else {
    console.warn(`⚠ content_scripts[0].run_at = ${JSON.stringify(contentScript.run_at)}, expected "document_start"`);
  }
} else {
  console.error(`✗ content_scripts not found or empty in manifest.json`);
  hasError = true;
}

// Check host_permissions
if (manifest.host_permissions && Array.isArray(manifest.host_permissions)) {
  const hasAmazonCoJp = manifest.host_permissions.some(p => p.includes("amazon.co.jp"));
  const hasLocalhost = manifest.host_permissions.some(p => p.includes("localhost"));
  
  if (hasAmazonCoJp) {
    console.log(`✓ host_permissions includes "amazon.co.jp"`);
  } else {
    console.error(`✗ host_permissions does not include "amazon.co.jp": ${JSON.stringify(manifest.host_permissions)}`);
    hasError = true;
  }
  
  if (hasLocalhost) {
    console.log(`✓ host_permissions includes "localhost"`);
  } else {
    console.warn(`⚠ host_permissions does not include "localhost": ${JSON.stringify(manifest.host_permissions)}`);
  }
} else {
  console.error(`✗ host_permissions not found or not an array in manifest.json`);
  hasError = true;
}

// Final result
console.log("\n" + "=".repeat(50));
if (hasError) {
  console.error("❌ Verification failed. Please fix the errors above.");
  process.exit(1);
} else {
  console.log("✅ All checks passed! dist folder is ready for Chrome extension.");
  process.exit(0);
}
