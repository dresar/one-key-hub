/**
 * ============================================================================
 * ONE KEY HUB - HUGGING FACE COMPREHENSIVE HUB & INFERENCE TEST & DOCUMENTATION
 * ============================================================================
 * 
 * Hugging Face (hf.co) is not just a platform to run AI models via Inference.
 * It is a fully featured Hub for hosting Machine Learning assets, including:
 * 
 * 1. HUB API (Non-AI Platform Operations):
 *    - Authenticate & check token permissions (/api/whoami)
 *    - Retrieve user profile and organizations info
 *    - List, search, create, update, and delete repositories (Models, Datasets, Spaces)
 *    - Access repository files, download assets, commit updates, and manage PRs
 * 
 * 2. INFERENCE API (AI Tasks):
 *    - Text Generation / Conversational (e.g. Qwen, Llama, Mistral)
 *    - Image Generation (e.g. Flux, Stable Diffusion)
 *    - Audio Generation / TTS (Text-to-Speech)
 *    - Embeddings / Feature Extraction (Sentence Transformers)
 *    - Computer Vision / Image Classification / Object Detection
 * 
 * This script serves as both an interactive tester and complete code reference.
 */

const API_KEY = "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"; // Example key provided

// --- Helper for HTTP requests using native fetch (Node 18+) ---
async function request(url, options = {}) {
  const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    
    // Check content type to handle binary data (e.g. generated images)
    const contentType = res.headers.get("content-type") || "";
    if (res.ok) {
      if (contentType.includes("image/") || contentType.includes("audio/")) {
        const buffer = await res.arrayBuffer();
        return { success: true, status: res.status, isBinary: true, contentType, size: buffer.byteLength };
      }
      const data = await res.json();
      return { success: true, status: res.status, data };
    } else {
      const errText = await res.text();
      return { success: false, status: res.status, error: errText };
    }
  } catch (err) {
    return { success: false, exception: true, error: err.message, code: err.code };
  }
}

// ============================================================================
// PART 1: HUGGING FACE HUB API OPERATIONS (Non-AI Platform)
// ============================================================================

/**
 * 1. Whoami Check
 * Gets the profile information of the account owner of this token.
 * Verify auth scope (read vs write permissions).
 */
async function testWhoami() {
  console.log("\n--- [HUB] Checking token details (/api/whoami) ---");
  const result = await request("https://huggingface.co/api/whoami");
  if (result.success) {
    console.log(`✅ Token is VALID (HTTP ${result.status})`);
    console.log(`User: ${result.data.name} (${result.data.fullname})`);
    console.log(`Email: ${result.data.email}`);
    console.log(`Scope: ${result.data.auth?.type || "unknown"}`);
  } else {
    printError("Whoami failed", result);
  }
}

/**
 * 2. Get Model Metadata
 * Fetches information about a specific model hosted on Hugging Face.
 */
async function testModelMetadata(modelId) {
  console.log(`\n--- [HUB] Fetching Model Metadata for: "${modelId}" ---`);
  const result = await request(`https://huggingface.co/api/models/${modelId}`);
  if (result.success) {
    console.log(`✅ Metadata retrieved (HTTP ${result.status})`);
    console.log(`Author: ${result.data.author}`);
    console.log(`Downloads last month: ${result.data.downloads}`);
    console.log(`Likes: ${result.data.likes}`);
    console.log(`Tags:`, result.data.tags.slice(0, 10), "...");
    console.log(`Task: ${result.data.pipeline_tag}`);
  } else {
    printError("Model metadata retrieval failed", result);
  }
}

/**
 * 3. List Datasets / Spaces
 * Queries Hugging Face Hub database to find active datasets.
 */
async function testListDatasets() {
  console.log("\n--- [HUB] Listing popular datasets (limit=3) ---");
  const result = await request("https://huggingface.co/api/datasets?limit=3&sort=downloads&direction=-1");
  if (result.success) {
    console.log(`✅ Datasets retrieved (HTTP ${result.status})`);
    result.data.forEach(d => {
      console.log(`- ${d.id} (Downloads: ${d.downloads}, Likes: ${d.likes})`);
    });
  } else {
    printError("Datasets query failed", result);
  }
}


// ============================================================================
// PART 2: HUGGING FACE INFERENCE API OPERATIONS (AI Models)
// ============================================================================

/**
 * 1. AI Text Generation (Inference)
 */
async function testTextGeneration(modelId, prompt) {
  console.log(`\n--- [AI] Testing Text Generation: "${modelId}" ---`);
  const result = await request(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 80, return_full_text: false }
    })
  });

  if (result.success) {
    console.log(`✅ Generation Success (HTTP ${result.status})`);
    const text = Array.isArray(result.data) ? result.data[0]?.generated_text : result.data?.generated_text;
    console.log(`Response: "${text || JSON.stringify(result.data)}"`);
  } else {
    printError("Text Generation failed", result);
  }
}

/**
 * 2. AI Embeddings / Feature Extraction (Inference)
 */
async function testEmbeddings(modelId, sentence) {
  console.log(`\n--- [AI] Testing Feature Extraction (Embeddings): "${modelId}" ---`);
  const result = await request(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    body: JSON.stringify({ inputs: sentence })
  });

  if (result.success) {
    console.log(`✅ Embeddings Success (HTTP ${result.status})`);
    const vector = result.data;
    if (Array.isArray(vector)) {
      console.log(`Vector Dimensions: ${vector.length || (vector[0] && vector[0].length)}`);
      console.log(`Sample vector prefix:`, vector.slice(0, 5), "...");
    } else {
      console.log("Response:", JSON.stringify(vector).substring(0, 150));
    }
  } else {
    printError("Feature Extraction failed", result);
  }
}

/**
 * 3. AI Text-to-Image (Inference)
 */
async function testImageGeneration(modelId, prompt) {
  console.log(`\n--- [AI] Testing Image Generation (Binary return): "${modelId}" ---`);
  const result = await request(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    body: JSON.stringify({ inputs: prompt })
  });

  if (result.success && result.isBinary) {
    console.log(`✅ Image Gen Success (HTTP ${result.status})`);
    console.log(`ContentType: ${result.contentType}`);
    console.log(`File Size: ${result.size} bytes`);
  } else {
    printError("Image Generation failed", result);
  }
}

// --- Helper to formatted print network/api errors ---
function printError(action, res) {
  if (res.exception) {
    console.log(`❌ ${action}: Connection failure (${res.error})`);
    if (res.code === "ENOTFOUND") {
      console.log("   👉 TIP: Hostname DNS lookup failed. Please run this script in an environment with full internet connectivity.");
    }
  } else {
    console.log(`❌ ${action}: API returned Error status ${res.status}`);
    console.log(`   Response details: ${res.error}`);
  }
}

// --- Main Runner ---
async function run() {
  console.log("====================================================================");
  console.log("Hugging Face API capabilities test script & reference docs");
  console.log("====================================================================");

  // PART 1: Hub API (Non-AI metadata & hub management)
  await testWhoami();
  await testModelMetadata("mistralai/Mistral-7B-Instruct-v0.3");
  await testListDatasets();

  // PART 2: Inference API (AI model inference)
  // Text Model
  await testTextGeneration("mistralai/Mistral-7B-Instruct-v0.3", "Hello! Tell me a fun fact about honey bees.");
  // Embeddings Model
  await testEmbeddings("sentence-transformers/all-MiniLM-L6-v2", "Hugging Face Hub integrates machine learning workflows.");
  // Image Model
  await testImageGeneration("black-forest-labs/FLUX.1-schnell", "A vintage watercolor painting of a lighthouse");

  console.log("\n====================================================================");
  console.log("Testing completed.");
  console.log("====================================================================");
}

run();
