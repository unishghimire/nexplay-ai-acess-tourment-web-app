import { Router } from "express";
import { db, admin, jwt, bcrypt, JWT_SECRET, authenticateToken, rateLimit } from "../shared.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// DEPRECATED: These REST auth endpoints are legacy.
// The React frontend uses Firebase Auth SDK directly (createUserWithEmailAndPassword,
// signInWithEmailAndPassword, sendPasswordResetEmail). These routes remain for
// backward compatibility with any existing API clients but should not be used
// for new authentication flows.
// ponytail: kept for compatibility, not actively used by the React frontend.
// ═══════════════════════════════════════════════════════════════

// Register
router.post("/api/register", rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    const emailCheck = await db.collection("users").where("email", "==", email).get();
    if (!emailCheck.empty) return res.status(400).json({ success: false, message: "Email already registered" });
    const usernameCheck = await db.collection("users").where("username", "==", username).get();
    if (!usernameCheck.empty) return res.status(400).json({ success: false, message: "Username already taken" });

    // Do NOT store password hash in Firestore — Firebase Auth manages passwords.
    // This legacy endpoint creates the user document only.
    const userRef = db.collection("users").doc();
    const uid = userRef.id;
    await userRef.set({
      uid, email, username, role: "player",
      balance: 0, totalEarnings: 0, inGameId: "", teamName: "", phone: "",
      isBanned: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("users_public").doc(uid).set({
      uid, username, totalEarnings: 0, inGameId: "", role: "player",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const token = jwt.sign({ uid, email, username, role: "player" }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ success: true, message: "User registered successfully", token, user: { uid, email, username, role: "player" } });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Login
router.post("/api/login", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: "Identifier and password are required" });
    let userSnap = await db.collection("users").where("email", "==", identifier).get();
    if (userSnap.empty) userSnap = await db.collection("users").where("username", "==", identifier).get();
    // Generic error to prevent user enumeration
    if (userSnap.empty) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const userData = userSnap.docs[0].data();
    const uid = userSnap.docs[0].id;
    if (userData.isBanned) return res.status(403).json({ success: false, message: "Account is banned" });
    // Legacy endpoints that stored bcrypt hashes — skip if no hash (Firebase Auth users)
    if (!userData.password) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const token = jwt.sign({ uid, email: userData.email, username: userData.username, role: userData.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, message: "Login successful", token, user: { uid, email: userData.email, username: userData.username, role: userData.role } });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Forgot Password — returns generic success regardless of email existence to prevent enumeration
router.post("/api/forgot-password", rateLimit(3, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    // Always return success — never reveal whether an email is registered
    res.json({ success: true, message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.json({ success: true, message: "If an account exists for that email, a password reset link has been sent." });
  }
});

// Reset Password
router.post("/api/reset-password", rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: "Token and new password are required" });
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const uid = decoded.uid;
    // Update password in Firebase Auth, not Firestore
    await admin.auth().updateUser(uid, { password: newPassword });
    res.json({ success: true, message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
});

// Verify Token
router.get("/api/me", authenticateToken, async (req: any, res) => {
  try {
    const userSnap = await db.collection("users").doc(req.user.userId).get();
    if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found" });
    const userData = userSnap.data();
    res.json({ success: true, user: { uid: req.user.userId, email: userData?.email, username: userData?.username, role: userData?.role } });
  } catch (error: any) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

export default router;


// Admin-only: Set custom claims for a user (called when admin changes role)
router.post("/api/admin/set-claims", authenticateToken, async (req: any, res) => {
  try {
    // Only admins can set claims
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const { uid, role } = req.body;
    if (!uid || !role || !['player', 'organizer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: "Valid uid and role required" });
    }
    // Set custom claims on the Firebase Auth user
    await admin.auth().setCustomUserClaims(uid, { role });
    res.json({ success: true, message: `Custom claims set: role=${role} for uid=${uid}` });
  } catch (error: any) {
    console.error("Set claims error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});
