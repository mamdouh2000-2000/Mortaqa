/* Mortaqa 5.2 public runtime configuration.
 * SAFE to ship: Firebase Web App config + public UI endpoints.
 * NEVER place CodeCraft/API secrets or Firebase Admin credentials here.
 */
window.MORTAQA_CONFIG = Object.freeze({
  version: "5.2.0",
  adminEmails: ["mmdwhrdwan82@gmail.com", "smha13334@gmail.com"],
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  },
  api: {
    aiEndpoint: "/api/ai",
    legacyAIProxyEndpoint: "/api/ai-proxy",
    modelsEndpoint: "/api/models",
    researchEndpoint: "/api/research",
    pointsEndpoint: "/api/points",
    healthEndpoint: "/api/health"
  },
  features: {
    firebaseAuth: true,
    firestore: true,
    firebaseStorage: false,
    externalMaterials: true,
    ai: true,
    aiVision: true,
    aiResearch: true,
    embeddings: true,
    groups: true,
    competitions: true,
    entertainment: true,
    spiritual: true,
    pwa: true
  }
});
