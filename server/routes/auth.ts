import { Router } from "express";
import { db, admin, jwt, bcrypt, JWT_SECRET, authenticateToken } from "../shared.js";

const router = Router();

// Register
router.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    const emailCheck = await db.collection("users").where("email", "==", email).get();
    if (!emailCheck.empty) return res.status(400).json({ success: false, message: "Email already registered" });
    const usernameCheck = await db.collection("users").where("username", "==", username).get();
    if (!usernameCheck.empty) return res.status(400).json({ success: false, message: "Username already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRef = db.collection("users").doc();
    const uid = userRef.id;
    await userRef.set({
      uid, email, username, password: hashedPassword, role: "player",
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
router.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: "Identifier and password are required" });
    let userSnap = await db.collection("users").where("email", "==", identifier).get();
    if (userSnap.empty) userSnap = await db.collection("users").where("username", "==", identifier).get();
    if (userSnap.empty) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const userData = userSnap.docs[0].data();
    const uid = userSnap.docs[0].id;
    if (userData.isBanned) return res.status(403).json({ success: false, message: "Account is banned" });
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });
    const token = jwt.sign({ uid, email: userData.email, username: userData.username, role: userData.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, message: "Login successful", token, user: { uid, email: userData.email, username: userData.username, role: userData.role } });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Forgot Password
router.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    const userSnap = await db.collection("users").where("email", "==", email).get();
    if (userSnap.empty) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "Password reset link sent to your email" });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Reset Password
router.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: "Token and new password are required" });
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
