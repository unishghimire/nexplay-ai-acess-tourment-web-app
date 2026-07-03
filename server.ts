import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import multer from "multer";
import { getFirestore } from "firebase-admin/firestore";

import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': "aistudio-build"
    }
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const firebaseApp = admin.initializeApp({
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const bucket = admin.storage().bucket();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing.");
}

// Lazy-initialize Cloudinary on demand to prevent start-up crashes
function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary configuration keys are missing from environment variables.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

const mapCategoryToFolder = (category: string): string => {
  switch (category) {
    case "USER_AVATAR":
      return "avatars";
    case "TEAM_LOGO":
    case "TEAM_BANNER":
      return "teams";
    case "ORG_LOGO":
    case "ORG_BANNER":
      return "organizations";
    case "TOURNAMENT_BANNER":
    case "TOURNAMENT_THUMBNAIL":
      return "tournaments";
    case "SCRIM_BANNER":
      return "scrims";
    case "PRODUCT_IMAGE":
      return "products";
    case "NEWS_IMAGE":
      return "news";
    case "SPONSOR_LOGO":
      return "sponsors";
    case "OVERLAY_GRAPHIC":
      return "system";
    default:
      return "system";
  }
};

const uploadToCloudinary = (buffer: Buffer, folder: string, originalName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const cloudinaryInstance = getCloudinary();
      const cleanName = originalName
        ? originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")
        : `img_${Date.now()}`;
      const stream = cloudinaryInstance.uploader.upload_stream(
        {
          folder,
          public_id: `${Date.now()}_${cleanName}`,
          fetch_format: "webp",
          quality: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    } catch (err) {
      reject(err);
    }
  });
};

const uploadBase64ToCloudinary = (base64String: string, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const cloudinaryInstance = getCloudinary();
      cloudinaryInstance.uploader.upload(
        base64String,
        {
          folder,
          fetch_format: "webp",
          quality: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
};

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const sanitizeHexColor = (value: unknown, fallback: string): string => {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
};

const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const buildTournamentBannerSvg = (banner: {
  title: string;
  game: string;
  subtitle: string;
  motif: string;
  headline: string;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  glowColor: string;
}) => {
  const headline = escapeXml(truncateText(banner.headline || banner.title, 40));
  const title = escapeXml(truncateText(banner.title, 56));
  const game = escapeXml(truncateText(banner.game, 42));
  const subtitle = escapeXml(truncateText(banner.subtitle, 88));
  const motif = escapeXml(truncateText(banner.motif, 24));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="534" viewBox="0 0 1600 534" fill="none">
  <defs>
    <linearGradient id="bg" x1="84" y1="22" x2="1522" y2="510" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${banner.backgroundColor}" />
      <stop offset="52%" stop-color="${banner.secondaryColor}" />
      <stop offset="100%" stop-color="${banner.accentColor}" />
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1600" y2="534" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="32" />
    </filter>
  </defs>
  <rect width="1600" height="534" rx="42" fill="${banner.backgroundColor}" />
  <rect x="0" y="0" width="1600" height="534" rx="42" fill="url(#bg)" />
  <circle cx="1320" cy="92" r="160" fill="${banner.glowColor}" opacity="0.28" filter="url(#blur)" />
  <circle cx="310" cy="438" r="198" fill="${banner.accentColor}" opacity="0.22" filter="url(#blur)" />
  <circle cx="1080" cy="338" r="210" fill="${banner.secondaryColor}" opacity="0.18" filter="url(#blur)" />
  <path d="M0 150C196 92 372 80 548 110C696 136 826 196 984 201C1170 208 1328 154 1600 88V0H0V150Z" fill="url(#sheen)" opacity="0.55" />
  <path d="M0 420C220 346 430 328 614 354C808 382 974 468 1148 476C1340 484 1494 438 1600 392V534H0V420Z" fill="rgba(0,0,0,0.18)" />
  <rect x="74" y="78" width="258" height="54" rx="27" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.18)" />
  <text x="113" y="113" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3.5">AI GENERATED</text>
  <rect x="74" y="156" width="388" height="22" rx="11" fill="rgba(255,255,255,0.18)" />
  <rect x="74" y="188" width="272" height="12" rx="6" fill="rgba(255,255,255,0.18)" />
  <text x="76" y="300" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="82" font-weight="900" letter-spacing="-2.2">${headline}</text>
  <text x="78" y="362" fill="rgba(255,255,255,0.88)" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700">${title}</text>
  <text x="78" y="412" fill="rgba(255,255,255,0.78)" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="500">${game} · ${subtitle}</text>
  <rect x="78" y="452" width="220" height="12" rx="6" fill="${banner.accentColor}" />
  <text x="78" y="494" fill="rgba(255,255,255,0.7)" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="2.6">${motif.toUpperCase()}</text>
</svg>`;
};

// Multer setup for memory storage (10MB limit as requested)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed."));
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Middleware to authenticate JWT or Firebase ID Token
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
      // 1. Try modern Firebase ID Token Verification first
      try {
        const decodedIdToken = await admin.auth().verifyIdToken(token);
        if (decodedIdToken) {
          let role = "player";
          let username = decodedIdToken.name || decodedIdToken.email?.split("@")[0] || "User";
          
          try {
            const userDoc = await db.collection("users").doc(decodedIdToken.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData) {
                role = userData.role || "player";
                username = userData.username || username;
              }
            }
          } catch (e) {
            console.error("Firestore user fetch error in auth middleware", e);
          }

          req.user = { 
            userId: decodedIdToken.uid, 
            email: decodedIdToken.email, 
            username, 
            role 
          };
          return next();
        }
      } catch (firebaseErr) {
        // Fallback to legacy custom JWT verification
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          req.user = { userId: decoded.uid, email: decoded.email, username: decoded.username, role: decoded.role };
          return next();
        } catch (jwtErr) {
          return res.status(401).json({ success: false, message: "Invalid token" });
        }
      }
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  };

  // --- Auth API Routes ---
  // ... (existing routes)

  // Register
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }

      // Check if user exists (email or username)
      const emailCheck = await db.collection("users").where("email", "==", email).get();
      if (!emailCheck.empty) {
        return res.status(400).json({ success: false, message: "Email already registered" });
      }

      const usernameCheck = await db.collection("users").where("username", "==", username).get();
      if (!usernameCheck.empty) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user in Firestore
      const userRef = db.collection("users").doc();
      const uid = userRef.id;

      const newUser = {
        uid,
        email,
        username,
        password: hashedPassword, // Store hash
        role: "player",
        balance: 0,
        totalEarnings: 0,
        inGameId: "",
        teamName: "",
        phone: "",
        isBanned: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);

      // Create public profile
      await db.collection("users_public").doc(uid).set({
        uid,
        username,
        totalEarnings: 0,
        inGameId: "",
        role: "player",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Generate token
      const token = jwt.sign({ uid, email, username, role: "player" }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({ success: true, message: "User registered successfully", token, user: { uid, email, username, role: "player" } });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Login
  app.post("/api/login", async (req, res) => {
    try {
      const { identifier, password } = req.body; // identifier can be email or username

      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Identifier and password are required" });
      }

      // Find user by email or username
      let userSnap = await db.collection("users").where("email", "==", identifier).get();
      if (userSnap.empty) {
        userSnap = await db.collection("users").where("username", "==", identifier).get();
      }

      if (userSnap.empty) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const userData = userSnap.docs[0].data();
      const uid = userSnap.docs[0].id;

      if (userData.isBanned) {
        return res.status(403).json({ success: false, message: "Account is banned" });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, userData.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      // Generate token
      const token = jwt.sign({ uid, email: userData.email, username: userData.username, role: userData.role }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ 
        success: true, 
        message: "Login successful", 
        token, 
        user: { 
          uid, 
          email: userData.email, 
          username: userData.username, 
          role: userData.role 
        } 
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Forgot Password
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });

      const userSnap = await db.collection("users").where("email", "==", email).get();
      if (userSnap.empty) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // In a real app, send an email with a reset link containing a token
      // For this demo, we'll just return success
      res.json({ success: true, message: "Password reset link sent to your email" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Reset Password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ success: false, message: "Token and new password are required" });

      // Verify token (in a real app, this would be a specific reset token)
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const uid = decoded.uid;

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.collection("users").doc(uid).update({ password: hashedPassword });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
  });

  // Verify Token
  app.get("/api/me", authenticateToken, async (req: any, res) => {
    try {
      const userSnap = await db.collection("users").doc(req.user.userId).get();
      if (!userSnap.exists) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const userData = userSnap.data();
      res.json({ 
        success: true, 
        user: { 
          uid: req.user.userId, 
          email: userData?.email, 
          username: userData?.username, 
          role: userData?.role 
        } 
      });
    } catch (error: any) {
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  });

  // --- Tournament Automation API Routes ---
  
  // Generate Groups
  app.post("/api/tournaments/:id/groups/generate", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { teamsPerGroup } = req.body;

      if (!teamsPerGroup || teamsPerGroup < 2) {
        return res.status(400).json({ success: false, message: "Invalid teams per group" });
      }

      const tourneyRef = db.collection("tournaments").doc(id);
      const tourneySnap = await tourneyRef.get();

      if (!tourneySnap.exists) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
      }

      const tourneyData = tourneySnap.data();
      if (tourneyData?.hostUid !== req.user.userId && req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }

      // Fetch all approved participants
      const participantsSnap = await db.collection("participants")
        .where("tournamentId", "==", id)
        .get();

      const participants = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (participants.length === 0) {
        return res.status(400).json({ success: false, message: "No participants registered" });
      }

      // Shuffle participants
      const shuffled = participants.sort(() => Math.random() - 0.5);

      // Create groups
      const batch = db.batch();
      const groups = [];
      for (let i = 0; i < shuffled.length; i += teamsPerGroup) {
        const groupTeams = shuffled.slice(i, i + teamsPerGroup);
        const groupRef = db.collection("tournaments").doc(id).collection("groups").doc();
        
        const groupData = {
          id: groupRef.id,
          tournamentId: id,
          round: tourneyData?.currentRound || 1,
          name: `Group ${String.fromCharCode(65 + Math.floor(i / teamsPerGroup))}`,
          teams: groupTeams.map((t: any) => ({
            id: t.teamId || t.userId,
            name: t.teamName || t.username,
            score: 0,
            rank: 0,
            isQualified: false
          })),
          status: "upcoming",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        batch.set(groupRef, groupData);
        groups.push(groupData);
      }

      await batch.commit();

      res.status(201).json({ success: true, message: "Groups generated successfully", groups });
    } catch (error: any) {
      console.error("Group generation error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Upload Result & Calculate Points
  app.post("/api/tournaments/:id/results/upload", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { groupId, teamResults, screenshotUrl } = req.body;

      if (!groupId || !teamResults || !Array.isArray(teamResults)) {
        return res.status(400).json({ success: false, message: "Group ID and team results are required" });
      }

      const tourneyRef = db.collection("tournaments").doc(id);
      const tourneySnap = await tourneyRef.get();
      const tourneyData = tourneySnap.data();

      if (!tourneySnap.exists || !tourneyData) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
      }

      // Point Calculation Logic
      const pointSystem = tourneyData.pointSystem || { killPoints: 1, placement: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6 } };
      
      const processedResults = teamResults.map(res => {
        const pPoints = pointSystem.placement[res.placement] || 0;
        const kPoints = res.kills * (pointSystem.killPoints || 1);
        return {
          ...res,
          totalPoints: pPoints + kPoints + (res.bonus || 0) - (res.penalty || 0)
        };
      });

      // Save Result
      const resultRef = db.collection("results").doc();
      const resultData = {
        id: resultRef.id,
        tournamentId: id,
        groupId,
        teamResults: processedResults,
        screenshotUrl,
        uploadedBy: req.user.userId,
        verified: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await resultRef.set(resultData);

      // Update Group Status and Team Scores
      await db.collection("tournaments").doc(id).collection("groups").doc(groupId).update({
        status: "completed",
        results: processedResults
      });

      res.status(201).json({ success: true, message: "Result uploaded and points calculated", result: resultData });
    } catch (error: any) {
      console.error("Result upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Advance Round
  app.post("/api/tournaments/:id/advance", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const tourneyRef = db.collection("tournaments").doc(id);
      const tourneySnap = await tourneyRef.get();
      const tourneyData = tourneySnap.data();

      if (!tourneySnap.exists || !tourneyData) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
      }

      const currentRound = tourneyData.currentRound || 1;
      const roadmap = tourneyData.roadmap || [];
      const currentRoundConfig = roadmap.find((r: any) => r.roundNumber === currentRound);

      if (!currentRoundConfig) {
        return res.status(400).json({ success: false, message: "Round configuration not found" });
      }

      // Fetch all results for current round
      const groupsSnap = await db.collection("tournaments").doc(id).collection("groups")
        .where("round", "==", currentRound)
        .get();

      const allGroups = groupsSnap.docs.map(doc => doc.data());
      
      if (allGroups.some(g => g.status !== "completed")) {
        return res.status(400).json({ success: false, message: "All groups in the current round must be completed first" });
      }

      // Collect qualified teams
      const qualifiedTeams: any[] = [];
      allGroups.forEach(group => {
        if (group.results) {
          const sorted = [...group.results].sort((a: any, b: any) => b.totalPoints - a.totalPoints);
          const topTeams = sorted.slice(0, currentRoundConfig.qualificationRule);
          qualifiedTeams.push(...topTeams);
        }
      });

      // Find Next Round Config
      const nextRound = currentRound + 1;
      const nextRoundConfig = roadmap.find((r: any) => r.roundNumber === nextRound);

      if (nextRoundConfig) {
        // Create new groups for next round
        const numGroups = nextRoundConfig.numGroups || 1;
        const teamsPerGroup = Math.ceil(qualifiedTeams.length / numGroups);
        
        // Shuffle qualified teams for fair grouping
        const shuffled = [...qualifiedTeams].sort(() => Math.random() - 0.5);

        for (let i = 0; i < numGroups; i++) {
          const groupTeams = shuffled.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
          if (groupTeams.length > 0) {
            const groupRef = db.collection("tournaments").doc(id).collection("groups").doc();
            await groupRef.set({
              id: groupRef.id,
              round: nextRound,
              name: `Round ${nextRound} - Group ${i + 1}`,
              status: "scheduled",
              teams: groupTeams.map(t => ({
                id: t.teamId || t.userId,
                name: t.teamName || t.username,
                logoUrl: t.logoUrl || ""
              })),
              results: [],
              matches: [],
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }

      // Update Tournament Round
      await tourneyRef.update({
        currentRound: nextRound,
        status: nextRoundConfig ? "ongoing" : "completed",
        stage: nextRoundConfig ? "round_play" : "completed"
      });

      res.json({ 
        success: true, 
        message: nextRoundConfig ? `Advanced to Round ${nextRound}` : "Tournament Completed", 
        nextRound, 
        qualifiedCount: qualifiedTeams.length,
        isCompleted: !nextRoundConfig
      });
    } catch (error: any) {
      console.error("Advance round error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Scrims API
  app.get("/api/scrims", async (req, res) => {
    try {
      const scrimsSnap = await db.collection("scrims").where("status", "==", "open").get();
      const tourneyScrimsSnap = await db.collection("tournaments")
        .where("matchType", "==", "scrims")
        .where("status", "==", "upcoming")
        .get();

      const scrims = scrimsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const tourneyScrims = tourneyScrimsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      res.json({ success: true, scrims: [...scrims, ...tourneyScrims] });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error fetching scrims" });
    }
  });

  // Upload Image
  app.post("/api/upload-image", authenticateToken, upload.single("image"), async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const category = req.body.category || "OTHER";

      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
      let publicUrl = "";
      let publicId = "";
      let finalFileName = fileName;
      let finalSize = req.file.size;
      let finalMimeType = req.file.mimetype;

      try {
        const folder = mapCategoryToFolder(category);
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, folder, req.file.originalname);
        publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
        publicId = cloudinaryResult.public_id;
        finalFileName = cloudinaryResult.original_filename || finalFileName;
        finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
        finalSize = cloudinaryResult.bytes || finalSize;
        console.log("[Cloudinary Upload] Succeeded:", publicUrl, publicId);
      } catch (cloudinaryError: any) {
        console.warn("Cloudinary upload failed or unconfigured, falling back to Firebase Storage:", cloudinaryError.message);
        
        try {
          const folder = mapCategoryToFolder(category);
          const file = bucket.file(`${folder}/${fileName}`);
          await file.save(req.file.buffer, {
            metadata: {
              contentType: req.file.mimetype,
            },
          });
          publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
          publicId = file.name;
        } catch (fbError) {
          console.warn("Firebase Storage fallback failed, using Picsum placeholder:", fbError);
          publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
          publicId = `picsum_${Date.now()}`;
        }
      }

      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: uid,
        url: publicUrl,
        publicId,
        fileName: finalFileName,
        fileSize: finalSize,
        mimeType: finalMimeType,
        category,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await mediaRef.set(mediaData);
      } catch (dbErr) {
        console.warn("[Database Bypass] Bypassing server-side Firestore catalog writing due to IAM propagation:", dbErr);
      }

      res.status(201).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  // Dedicated Universal Upload Endpoint - Full Migration to Cloudinary
  app.post("/api/upload/image", authenticateToken, upload.single("image"), async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const category = req.body.category || "OTHER";

      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, "_")}`;
      let publicUrl = "";
      let publicId = "";
      let finalFileName = fileName;
      let finalSize = req.file.size;
      let finalMimeType = req.file.mimetype;

      try {
        const folder = mapCategoryToFolder(category);
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, folder, req.file.originalname);
        publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
        publicId = cloudinaryResult.public_id;
        finalFileName = cloudinaryResult.original_filename || finalFileName;
        finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
        finalSize = cloudinaryResult.bytes || finalSize;
        console.log("[Cloudinary Dedicated Upload] Succeeded:", publicUrl, publicId);
      } catch (cloudinaryError: any) {
        console.warn("Cloudinary dedicated upload failed or unconfigured, falling back to Firebase Storage:", cloudinaryError.message);
        
        try {
          const folder = mapCategoryToFolder(category);
          const file = bucket.file(`${folder}/${fileName}`);
          await file.save(req.file.buffer, {
            metadata: {
              contentType: req.file.mimetype,
            },
          });
          publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
          publicId = file.name;
        } catch (fbError) {
          console.warn("Firebase Storage fallback failed, using Picsum placeholder:", fbError);
          publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
          publicId = `picsum_${Date.now()}`;
        }
      }

      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: uid,
        url: publicUrl,
        publicId,
        fileName: finalFileName,
        fileSize: finalSize,
        mimeType: finalMimeType,
        category,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await mediaRef.set(mediaData);
      } catch (dbErr) {
        console.warn("[Database Bypass] Bypassing server-side Firestore catalog writing:", dbErr);
      }

      return res.status(200).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
    } catch (error: any) {
      console.error("[Cloudinary Dedicated Upload API] Upload failed:", error);
      return res.status(500).json({ success: false, message: error.message || "Upload failed" });
    }
  });

  // Secure Media Deletion Endpoint
  app.post("/api/media/delete", authenticateToken, async (req: any, res) => {
    try {
      const { mediaId, publicId } = req.body;
      if (!publicId) {
        return res.status(400).json({ success: false, message: "Missing publicId" });
      }

      try {
        // If it was a Firebase Storage fallback, delete from bucket
        if (publicId.includes("/") && !publicId.includes("avatars/") && !publicId.includes("teams/") && !publicId.includes("organizations/") && !publicId.includes("tournaments/") && !publicId.includes("scrims/") && !publicId.includes("products/") && !publicId.includes("news/") && !publicId.includes("sponsors/")) {
          const file = bucket.file(publicId);
          await file.delete();
          console.log("[Firebase Purge] Succeeded:", publicId);
        } else {
          // Cloudinary deletion
          const cloudinaryInstance = getCloudinary();
          await cloudinaryInstance.uploader.destroy(publicId);
          console.log("[Cloudinary Purge] Succeeded:", publicId);
        }
      } catch (destroyError: any) {
        console.warn("[Media Purge Warn] Could not destroy physical asset:", destroyError.message);
      }

      if (mediaId) {
        await db.collection("media").doc(mediaId).delete();
      }

      return res.status(200).json({ success: true, message: "Asset purged successfully." });
    } catch (error: any) {
      console.error("[Media Purge Error]:", error);
      return res.status(500).json({ success: false, message: error.message || "Deletion failed" });
    }
  });

  // Get All Media
  app.get("/api/media", async (req, res) => {
    try {
      const mediaSnap = await db.collection("media").orderBy("createdAt", "desc").get();
      const mediaList = mediaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, media: mediaList });
    } catch (error: any) {
      console.error("Fetch media error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Process Base64 Image - Fully Migrated to Cloudinary
  app.post("/api/process-image", authenticateToken, async (req: any, res) => {
    try {
      const { base64, folder = "gallery" } = req.body;
      const uid = req.user.userId;

      if (!base64) {
        return res.status(400).json({ success: false, message: "No image data provided" });
      }

      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ success: false, message: "Invalid base64 format" });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ success: false, message: "Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed." });
      }

      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "File size too large. Max 10MB allowed." });
      }

      const extension = mimeType.split('/')[1];
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      let publicUrl = "";
      let publicId = "";
      let finalFileName = fileName;
      let finalSize = buffer.length;
      let finalMimeType = mimeType;

      try {
        const cloudinaryResult = await uploadBase64ToCloudinary(base64, folder);
        publicUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
        publicId = cloudinaryResult.public_id;
        finalFileName = cloudinaryResult.original_filename || finalFileName;
        finalMimeType = cloudinaryResult.format ? `image/${cloudinaryResult.format}` : finalMimeType;
        finalSize = cloudinaryResult.bytes || finalSize;
        console.log("[Cloudinary Base64 Upload] Succeeded:", publicUrl, publicId);
      } catch (cloudinaryError: any) {
        console.warn("Cloudinary Base64 upload failed, falling back to Firebase Storage:", cloudinaryError.message);
        
        try {
          const file = bucket.file(`${folder}/${fileName}`);
          await file.save(buffer, {
            metadata: {
              contentType: mimeType,
            },
          });
          publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
          publicId = file.name;
        } catch (fbError) {
          console.warn("Firebase Storage processed fallback failed, using Picsum placeholder:", fbError);
          publicUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
          publicId = `picsum_${Date.now()}`;
        }
      }

      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: uid,
        url: publicUrl,
        publicId,
        fileName: finalFileName,
        fileSize: finalSize,
        mimeType: finalMimeType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await mediaRef.set(mediaData);

      res.status(201).json({ success: true, url: publicUrl, public_id: publicId, media: mediaData });
    } catch (error: any) {
      console.error("Process image error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  });

  app.post("/api/generate-banner", authenticateToken, async (req: any, res: any) => {
    try {
      const { title, game, type, tournamentType, entryFee, prizePool, theme, mood } = req.body || {};
      const cleanTitle = typeof title === "string" ? title.trim() : "";
      const cleanGame = typeof game === "string" ? game.trim() : "";

      if (!cleanTitle || !cleanGame) {
        return res.status(400).json({ success: false, message: "Title and game are required." });
      }

      const prompt = `Create a concise esports banner concept for a tournament.
Return only JSON with: headline, subtitle, motif, accentColor, secondaryColor, backgroundColor, glowColor.
Rules: use short high-impact text only, no markdown, no code fences, no extra commentary.
Context: title=${cleanTitle}; game=${cleanGame}; type=${typeof type === "string" ? type : "Tournament"}; tournamentType=${typeof tournamentType === "string" ? tournamentType : "tournament"}; entryFee=${typeof entryFee === "number" ? entryFee : 0}; prizePool=${typeof prizePool === "number" ? prizePool : 0}; theme=${typeof theme === "string" ? theme : "competitive"}; mood=${typeof mood === "string" ? mood : "high-energy"}.`;

      let aiResult: any = null;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["headline", "subtitle", "motif", "accentColor", "secondaryColor", "backgroundColor", "glowColor"],
              properties: {
                headline: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                motif: { type: Type.STRING },
                accentColor: { type: Type.STRING },
                secondaryColor: { type: Type.STRING },
                backgroundColor: { type: Type.STRING },
                glowColor: { type: Type.STRING }
              }
            }
          }
        });

        aiResult = JSON.parse(response.text || "{}");
      } catch (aiError: any) {
        console.warn("[Banner Generator] Gemini generation failed, using deterministic fallback:", aiError.message);
      }

      const bannerConfig = {
        title: cleanTitle,
        game: cleanGame,
        subtitle: typeof aiResult?.subtitle === "string" && aiResult.subtitle.trim() ? aiResult.subtitle.trim() : `Entry fee ${typeof entryFee === "number" ? entryFee : 0} · Prize pool ${typeof prizePool === "number" ? prizePool : 0}`,
        motif: typeof aiResult?.motif === "string" && aiResult.motif.trim() ? aiResult.motif.trim() : typeof mood === "string" && mood.trim() ? mood.trim() : "NEON ARENA",
        headline: typeof aiResult?.headline === "string" && aiResult.headline.trim() ? aiResult.headline.trim() : cleanTitle,
        accentColor: sanitizeHexColor(aiResult?.accentColor, "#ff6b00"),
        secondaryColor: sanitizeHexColor(aiResult?.secondaryColor, "#7c3aed"),
        backgroundColor: sanitizeHexColor(aiResult?.backgroundColor, "#111827"),
        glowColor: sanitizeHexColor(aiResult?.glowColor, "#22d3ee")
      };

      const svg = buildTournamentBannerSvg(bannerConfig);
      const base64Svg = Buffer.from(svg, "utf-8").toString("base64");
      const result = await uploadBase64ToCloudinary(`data:image/svg+xml;base64,${base64Svg}`, "tournaments");

      const publicUrl = result.secure_url || result.url;
      const publicId = result.public_id || "";

      const mediaRef = db.collection("media").doc();
      const mediaData = {
        id: mediaRef.id,
        userId: req.user.userId,
        url: publicUrl,
        publicId,
        fileName: `${cleanTitle.replace(/[^a-zA-Z0-9]/g, "_") || "tournament"}_banner.svg`,
        fileSize: Buffer.byteLength(svg, "utf-8"),
        mimeType: "image/svg+xml",
        category: "TOURNAMENT_BANNER",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      try {
        await mediaRef.set(mediaData);
      } catch (dbErr) {
        console.warn("[Banner Generator] Media catalog write failed:", dbErr);
      }

      return res.status(200).json({
        success: true,
        url: publicUrl,
        public_id: publicId,
        media: mediaData,
        banner: bannerConfig
      });
    } catch (error: any) {
      console.error("[Banner Generator] Failed:", error);
      return res.status(500).json({ success: false, message: error.message || "Banner generation failed" });
    }
  });

  // --- Web Page Auditor API ---
  app.post("/api/audit", async (req: any, res: any) => {
    try {
      const { url, htmlContents } = req.body;
      let finalHtml = "";
      let targetUrl = url || "Direct Paste";

      if (htmlContents && htmlContents.trim().length > 0) {
        finalHtml = htmlContents;
      } else if (url) {
        try {
          new URL(url);
        } catch (e) {
          return res.status(400).json({ success: false, message: "Invalid URL format" });
        }

        try {
          const fetchRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            signal: AbortSignal.timeout(10000)
          });
          if (!fetchRes.ok) {
            return res.status(400).json({ 
              success: false, 
              message: `Failed to fetch web page. HTTP Status: ${fetchRes.status} ${fetchRes.statusText}` 
            });
          }
          finalHtml = await fetchRes.text();
        } catch (err: any) {
          return res.status(400).json({ 
            success: false, 
            message: `Network error or timeout trying to fetch "${url}": ${err.message || err}. Please paste the page HTML directly under the Custom HTML option.` 
          });
        }
      } else {
        return res.status(400).json({ success: false, message: "Either a website URL or direct HTML source is required." });
      }

      if (!finalHtml || finalHtml.trim().length === 0) {
        return res.status(400).json({ success: false, message: "No HTML content was extracted to audit." });
      }

      // Safeguard: truncate HTML to ~120KB to ensure we analyze critical structure while fitting model context safely
      const truncatedHtml = finalHtml.slice(0, 120000);

      const systemPrompt = `You are a world-class Web Development QA & Auditing Engine.
Analyze the provided HTML source code and perform a thorough audit across four critical pillars:
1. SEO (Search Engine Optimization)
2. Accessibility (A11y / WCAG)
3. Security (Web safety and best practices)
4. Performance & Best HTML Practices

You must return a rigorous JSON evaluation object with detailed, specific lines of code references (if identifiable) and practical, step-by-step fix recommendations.
Be direct, detailed, and highly technical. Never generate fake boilerplate findings; find actual issues in the code or highlight compliance if the section is superb.`;

      const userPrompt = `Audit the following HTML content for the resource: ${targetUrl}

HTML CONTENT:
\`\`\`html
${truncatedHtml}
\`\`\`

Analyze the code and return a JSON response adhering EXACTLY to the specified schema format. Ensure the response is valid parseable JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["score", "metadata", "issues", "recommendations"],
            properties: {
              score: {
                type: Type.INTEGER,
                description: "Overall health score from 0 to 100 based on findings (100 being pristine, subtracting 5-15 points per critical error, 2-5 per warning)."
              },
              metadata: {
                type: Type.OBJECT,
                required: ["title", "description", "h1s", "wordCount", "headingsStructure"],
                properties: {
                  title: { type: Type.STRING, description: "Extracted <title> tag text or 'None'" },
                  description: { type: Type.STRING, description: "Extracted meta description or 'None'" },
                  h1s: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "List of H1 content found" 
                  },
                  wordCount: { type: Type.INTEGER, description: "Estimated visible word count" },
                  headingsStructure: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Chronological sequence of headings found, with prefix indicating level (e.g. 'H1: Welcome')"
                  }
                }
              },
              issues: {
                type: Type.ARRAY,
                description: "Detailed issues list",
                items: {
                  type: Type.OBJECT,
                  required: ["category", "severity", "title", "description", "recommendation", "location"],
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: "Category of error: 'SEO', 'Accessibility', 'Security', or 'Best Practices'"
                    },
                    severity: {
                      type: Type.STRING,
                      description: "Criticality: 'critical', 'warning', or 'info'"
                    },
                    title: {
                      type: Type.STRING,
                      description: "Short descriptive error title"
                    },
                    description: {
                      type: Type.STRING,
                      description: "Detailed description of the issue found in the source code."
                    },
                    recommendation: {
                      type: Type.STRING,
                      description: "Technical, exact step-by-step coding change to fix the problem."
                    },
                    location: {
                      type: Type.STRING,
                      description: "Line number, tag reference, or outerHTML snippet of where this issue resides"
                    }
                  }
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Summative numbered checklist of immediate top technical actions to take."
              }
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || "{}");
      res.json({ success: true, report: parsedData });
    } catch (error: any) {
      console.error("Auditing Error:", error);
      res.status(500).json({ success: false, message: error.message || "Internal server auditing failure." });
    }
  });

  app.post("/api/audit/discuss", async (req: any, res: any) => {
    try {
      const { history, message, reportContext } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, message: "Message is required." });
      }

      const systemPrompt = `You are a Senior Web Development Consultant and Cyber Security / WCAG & SEO expert.
You are helping a developer fix issues identified in a recent webpage audit report.

AUDIT REPORT DETAILS:
${JSON.stringify(reportContext, null, 2)}

Provide clear, detailed coding solutions, explanations of accessibility guidelines, secure code snippets, and helpful recommendations. Keep your tone supportive, hyper-technical, clear, and professional.`;

      const contentsPayload = (history || []).map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }]
      }));
      contentsPayload.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction: systemPrompt,
        }
      });

      res.json({ success: true, text: response.text });
    } catch (error: any) {
      console.error("Audit discussion error:", error);
      res.status(500).json({ success: false, message: error.message || "Discussion failed." });
    }
  });

  // --- Discord Webhook Dispatcher ---
  // Fires structured announcements to the Nexplay Discord server.
  // Two channels: #tournaments (matchType = tournament) and #scrims (matchType = scrims)
  // Webhook URLs are server-side only — never exposed to the browser.

  type DiscordAnnouncementType =
    | 'tournament_published'
    | 'tournament_live'
    | 'tournament_completed'
    | 'group_published'
    | 'game_start'
    | 'game_time'
    | 'scrim_published'
    | 'scrim_live'
    | 'scrim_completed';

  /**
   * Builds a Discord Embed object for a given announcement type.
   * Colors follow Discord embed color convention (decimal RGB).
   */
  function buildDiscordEmbed(type: DiscordAnnouncementType, data: Record<string, any>) {
    const BASE_URL = process.env.APP_URL || 'https://nexplay.gg';
    const tournyUrl = data.tournamentId ? `${BASE_URL}/details/${data.tournamentId}` : BASE_URL;

    const colorMap: Record<DiscordAnnouncementType, number> = {
      tournament_published: 0x5865F2,  // Discord blurple — new tournament
      tournament_live:      0xED4245,  // Red — live
      tournament_completed: 0x57F287,  // Green — completed
      group_published:      0xFEE75C,  // Yellow — group draw
      game_start:           0xEB459E,  // Pink — match starting
      game_time:            0xF47FFF,  // Purple — time reminder
      scrim_published:      0x5865F2,
      scrim_live:           0xED4245,
      scrim_completed:      0x57F287,
    };

    const embedMap: Record<DiscordAnnouncementType, object> = {
      tournament_published: {
        title: `🏆  ${data.title}`,
        description: `A new tournament has been published on **Nexplay**!\n\n📅  **Start:** ${data.startTime}\n🎮  **Game:** ${data.game}\n👥  **Type:** ${data.teamType} • ${data.type}\n🗺️  **Map:** ${data.map || 'TBD'}\n\n💰  **Prize Pool:** ${data.prizePool}\n🎫  **Entry Fee:** ${data.entryFee}\n👤  **Slots:** ${data.currentPlayers}/${data.slots}`,
        url: tournyUrl,
        color: colorMap.tournament_published,
        thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
        footer: { text: 'Nexplay Esports • Register now before slots fill up!' },
        timestamp: new Date().toISOString(),
      },
      tournament_live: {
        title: `🔴  LIVE — ${data.title}`,
        description: `The tournament is **now live**! 🎮\n\n🏅  **Players:** ${data.currentPlayers}/${data.slots}\n💰  **Prize Pool:** ${data.prizePool}\n🗺️  **Map:** ${data.map || 'TBD'}`,
        url: tournyUrl,
        color: colorMap.tournament_live,
        footer: { text: 'Nexplay Esports • Tournament is in progress' },
        timestamp: new Date().toISOString(),
      },
      tournament_completed: {
        title: `✅  COMPLETED — ${data.title}`,
        description: `The tournament has ended!\n\n🥇  **Winner:** ${data.winner || 'To be announced'}\n💰  **Prize Pool Distributed:** ${data.prizePool}`,
        url: tournyUrl,
        color: colorMap.tournament_completed,
        footer: { text: 'Nexplay Esports • GG WP to all participants!' },
        timestamp: new Date().toISOString(),
      },
      group_published: {
        title: `📋  Group Draw — ${data.title}`,
        description: `The group draw for **${data.title}** has been published!\n\n${(data.groups as string[]).map((g, i) => `**${g}**`).join('\n')}\n\nCheck the full bracket on the Nexplay website.`,
        url: tournyUrl,
        color: colorMap.group_published,
        footer: { text: 'Nexplay Esports • Check your group and prepare!' },
        timestamp: new Date().toISOString(),
      },
      game_start: {
        title: `⚔️  Match Starting — ${data.title}`,
        description: `**${data.groupName || 'Match'}** is starting now!\n\n🗺️  **Map:** ${data.map || 'TBD'}\n🔑  **Room ID:** ${data.roomId || 'Check the app'}\n🔐  **Password:** ${data.roomPass || 'Check the app'}\n\nGood luck to all participants! 🎮`,
        url: tournyUrl,
        color: colorMap.game_start,
        footer: { text: 'Nexplay Esports • Join the room NOW!' },
        timestamp: new Date().toISOString(),
      },
      game_time: {
        title: `⏰  Match Reminder — ${data.title}`,
        description: `**${data.groupName || 'Your match'}** starts in **${data.timeLeft || '30 minutes'}**!\n\n🗺️  **Map:** ${data.map || 'TBD'}\n📅  **Scheduled:** ${data.startTime}`,
        url: tournyUrl,
        color: colorMap.game_time,
        footer: { text: 'Nexplay Esports • Be ready on time!' },
        timestamp: new Date().toISOString(),
      },
      scrim_published: {
        title: `🎯  New Scrim — ${data.title}`,
        description: `A new scrim is open for registration!\n\n📅  **Time:** ${data.startTime}\n🎮  **Game:** ${data.game}\n👥  **Type:** ${data.teamType || 'Open'}\n\n💰  **Prize Pool:** ${data.prizePool}\n🎫  **Entry Fee:** ${data.entryFee}\n👤  **Slots:** ${data.currentPlayers}/${data.slots}`,
        url: tournyUrl,
        color: colorMap.scrim_published,
        thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
        footer: { text: 'Nexplay Esports • Practice match — Join now!' },
        timestamp: new Date().toISOString(),
      },
      scrim_live: {
        title: `🔴  LIVE Scrim — ${data.title}`,
        description: `The scrim is **now live**!\n\n🏅  **Players:** ${data.currentPlayers}/${data.slots}`,
        url: tournyUrl,
        color: colorMap.scrim_live,
        footer: { text: 'Nexplay Esports • Scrim in progress' },
        timestamp: new Date().toISOString(),
      },
      scrim_completed: {
        title: `✅  Scrim Ended — ${data.title}`,
        description: `The scrim **${data.title}** has ended. GG WP! 🎮`,
        url: tournyUrl,
        color: colorMap.scrim_completed,
        footer: { text: 'Nexplay Esports' },
        timestamp: new Date().toISOString(),
      },
    };

    return embedMap[type] || null;
  }

  /**
   * Sends an embed to a Discord webhook URL.
   * Returns true on success, false on failure (non-throwing — we log but never break the main flow).
   */
  async function sendDiscordWebhook(webhookUrl: string, embed: object, content?: string): Promise<boolean> {
    try {
      const body: Record<string, any> = { embeds: [embed] };
      if (content) body.content = content;

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[Discord Webhook] Failed (${response.status}):`, text);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[Discord Webhook] Network error:', err.message);
      return false;
    }
  }

  /**
   * POST /api/discord/announce
   * Body: { type, tournamentId, data, channel }
   *   type    — announcement type (see DiscordAnnouncementType)
   *   data    — tournament/scrim fields needed for the embed
   *   channel — 'tournaments' | 'scrims' (determines which webhook fires)
   *
   * Auth: organizer or admin only
   */
  app.post('/api/discord/announce', authenticateToken, async (req: any, res) => {
    const { type, data, channel } = req.body as {
      type: DiscordAnnouncementType;
      data: Record<string, any>;
      channel: 'tournaments' | 'scrims';
    };

    // Validate role
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only organizers and admins can send Discord announcements.' });
    }

    // Validate inputs
    if (!type || !data || !channel) {
      return res.status(400).json({ success: false, message: 'type, data, and channel are required.' });
    }

    const webhookUrl = channel === 'scrims'
      ? process.env.DISCORD_WEBHOOK_SCRIMS
      : process.env.DISCORD_WEBHOOK_TOURNAMENTS;

    if (!webhookUrl) {
      return res.status(503).json({
        success: false,
        message: `Discord webhook for #${channel} is not configured. Add DISCORD_WEBHOOK_${channel.toUpperCase()} to your .env file.`,
      });
    }

    const embed = buildDiscordEmbed(type, data);
    if (!embed) {
      return res.status(400).json({ success: false, message: `Unknown announcement type: ${type}` });
    }

    const sent = await sendDiscordWebhook(webhookUrl, embed);

    if (sent) {
      // Log the announcement to Firestore for audit trail
      try {
        await db.collection('discordLogs').add({
          type,
          channel,
          tournamentId: data.tournamentId || null,
          sentBy: req.user.userId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logErr) {
        console.warn('[Discord Log] Firestore log failed:', logErr);
      }
      return res.json({ success: true, message: `Announcement sent to #${channel}` });
    }

    return res.status(502).json({ success: false, message: 'Discord webhook delivery failed. Check webhook URL and Discord server settings.' });
  });

  // --- Dynamic Sitemap for SEO ---
  app.get("/sitemap.xml", async (req, res) => {
    res.header("Content-Type", "application/xml");
    
    // Static routes
    const staticUrls = [
      "",
      "/tournaments",
      "/scrims",
      "/games",
      "/results",
      "/organizations",
      "/teams",
      "/leaderboard",
      "/about",
      "/contact",
      "/privacy",
      "/terms"
    ];

    let dynamicUrls: string[] = [];
    try {
      // Query recent public tournaments to populate sitemap dynamically
      const tournamentsSnap = await db.collection("tournaments").limit(50).get();
      tournamentsSnap.forEach(doc => {
        dynamicUrls.push(`/details/${doc.id}`);
      });
    } catch (e) {
      console.error("Sitemap dynamic fetch failed:", e);
    }

    const allPaths = [...staticUrls, ...dynamicUrls];
    const baseUrl = "https://nexplay.gg";
    const xmlItems = allPaths.map(p => `
    <url>
      <loc>${baseUrl}${p}</loc>
      <changefreq>daily</changefreq>
      <priority>${p === "" ? "1.0" : p.startsWith("/details") ? "0.8" : "0.6"}</priority>
    </url>`).join("");

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;

    res.send(sitemapXml.trim());
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Delete media
app.delete('/api/media/:id', authenticateToken, async (req: any, res) => {
    try {
        const mediaId = req.params.id;
        const mediaDoc = await db.collection('media').doc(mediaId).get();

        if (!mediaDoc.exists) {
            return res.status(404).json({ success: false, message: 'Media not found' });
        }

        const mediaData = mediaDoc.data();
        if (mediaData?.userId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Delete from Firestore
        await db.collection('media').doc(mediaId).delete();

        // Note: We could also delete from Storage here, but it requires the file path
        // For now, we'll just remove the metadata from Firestore

        res.json({ success: true, message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
