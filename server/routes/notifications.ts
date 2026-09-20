import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";

const router = Router();

// Helper to hash an FCM token string into a safe document ID
const hashToken = (token: string): string => {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i);
    hash |= 0;
  }
  return `device_${Math.abs(hash).toString(36)}`;
};

/**
 * POST /api/notifications/fcm-token
 * Registers or updates an FCM device token for push notifications
 */
router.post(
  "/api/notifications/fcm-token",
  authenticateToken,
  rateLimit(20, 60 * 1000),
  async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const { token, platform, userAgent } = req.body;

      if (!token || typeof token !== "string" || token.length < 10 || token.length > 500) {
        return res.status(400).json({ success: false, message: "Valid token is required" });
      }

      const docId = hashToken(token);
      const tokenRef = db
        .collection("users")
        .doc(uid)
        .collection("fcm_tokens")
        .doc(docId);

      await tokenRef.set({
        token,
        userId: uid,
        platform: platform === "mobile" ? "mobile" : "desktop",
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : "unknown",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(200).json({ success: true, message: "Device token registered" });
    } catch (error: any) {
      console.error("Error registering FCM token:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to register token" });
    }
  }
);

/**
 * DELETE /api/notifications/fcm-token
 * Deregisters an FCM device token
 */
router.delete(
  "/api/notifications/fcm-token",
  authenticateToken,
  async (req: any, res) => {
    try {
      const uid = req.user.userId;
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ success: false, message: "Token is required" });
      }

      const docId = hashToken(token);
      await db
        .collection("users")
        .doc(uid)
        .collection("fcm_tokens")
        .doc(docId)
        .delete();

      res.status(200).json({ success: true, message: "Device token unregistered" });
    } catch (error: any) {
      console.error("Error unregistering FCM token:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to unregister token" });
    }
  }
);

/**
 * POST /api/notifications/send-push
 * Dispatches push notifications to recipient devices via Firebase Cloud Messaging
 */
router.post(
  "/api/notifications/send-push",
  authenticateToken,
  rateLimit(30, 60 * 1000),
  async (req: any, res) => {
    try {
      const callerUid = req.user.userId;
      const callerRole = req.user.role;
      const { targetUserId, title, body, link, data } = req.body;

      const recipientUid = targetUserId || callerUid;

      // Only self, organizer, or admin can send push notifications
      if (recipientUid !== callerUid && callerRole !== "admin" && callerRole !== "organizer") {
        return res.status(403).json({ success: false, message: "Unauthorized to send push notification to this user" });
      }

      if (!title || typeof title !== "string" || !body || typeof body !== "string") {
        return res.status(400).json({ success: false, message: "Title and body are required" });
      }

      // Fetch recipient's active device tokens
      const tokensSnap = await db
        .collection("users")
        .doc(recipientUid)
        .collection("fcm_tokens")
        .get();

      if (tokensSnap.empty) {
        return res.status(200).json({
          success: true,
          delivered: 0,
          message: "No registered push devices found for this user",
        });
      }

      const tokenDocs = tokensSnap.docs;
      const tokens = Array.from(new Set(tokenDocs.map((d: any) => d.data()?.token).filter(Boolean)));

      if (tokens.length === 0) {
        return res.status(200).json({
          success: true,
          delivered: 0,
          message: "No valid push tokens found",
        });
      }

      const payload: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: title.slice(0, 100),
          body: body.slice(0, 250),
        },
        data: {
          url: link || "/",
          ...(data || {}),
        },
        webpush: {
          fcmOptions: {
            link: link || "/",
          },
          notification: {
            icon: "/logo.png",
            badge: "/favicon-32x32.png",
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(payload);

      // Clean up invalid or expired tokens
      const tokensToDelete: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            tokensToDelete.push(tokens[idx]);
          }
        }
      });

      if (tokensToDelete.length > 0) {
        const batch = db.batch();
        tokensToDelete.forEach((badToken) => {
          const badDocId = hashToken(badToken);
          const ref = db.collection("users").doc(recipientUid).collection("fcm_tokens").doc(badDocId);
          batch.delete(ref);
        });
        await batch.commit().catch((err: any) => console.warn("Failed to prune invalid tokens:", err));
      }

      res.status(200).json({
        success: true,
        delivered: response.successCount,
        failed: response.failureCount,
        message: `Push delivered to ${response.successCount} device(s)`,
      });
    } catch (error: any) {
      console.error("Error sending push notification:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to send push notification" });
    }
  }
);

export default router;
