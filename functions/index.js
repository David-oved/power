const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin SDK
admin.initializeApp();

// Define secret parameter for the Gemini API Key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.callGeminiModel = onRequest({ secrets: [geminiApiKey] }, (req, res) => {
  cors(req, res, async () => {
    try {
      // 1. Verify User Authentication (Firebase ID Token)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (authError) {
        console.error("Token verification failed:", authError);
        return res.status(401).json({ error: "Unauthorized: Token verification failed" });
      }

      // User is authenticated, we can log the UID for audit if needed
      const uid = decodedToken.uid;
      console.log(`AI request from user: ${uid}`);

      // 2. Retrieve request params
      const { prompt, systemInstruction } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Bad Request: Missing prompt parameter" });
      }

      // 3. Retrieve Gemini API Key from Secrets Manager
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        console.error("GEMINI_API_KEY secret parameter is empty");
        return res.status(500).json({ error: "Internal Server Error: AI key not configured on server" });
      }

      // 4. Request Gemini API (1.5 Flash)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API returned error code ${response.status}:`, errText);
        return res.status(response.status).json({ error: "Gemini API Error", details: errText });
      }

      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error("Unhandled server error:", err);
      return res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
  });
});
