const path = require("path");
const fs = require("fs");
const { collectionofficer } = require("../startup/database");
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

let firebaseApp = null;
let messaging = null;
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return messaging;

  try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (_) {
        try {
          serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
          );
        } catch (parseErr) {
          console.error("❌ [PushService] Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", parseErr.message);
        }
      }
    }

    if (!serviceAccount) {
      const serviceAccountPath = path.join(__dirname, "../config/firebase-service-account.json");
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = require(serviceAccountPath);
      }
    }

    if (!serviceAccount) {
      console.warn("⚠️ [PushService] No Firebase credentials found (checked FIREBASE_SERVICE_ACCOUNT env and config/firebase-service-account.json)");
      return null;
    }

    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("🔥 [PushService] Firebase Admin SDK initialized successfully with project:", serviceAccount.project_id);
    } else {
      firebaseApp = getApps()[0];
    }

    messaging = getMessaging(firebaseApp);
    firebaseInitialized = true;
    return messaging;
  } catch (err) {
    console.error("❌ [PushService] Failed to initialize Firebase Admin SDK:", err.message);
    return null;
  }
}

/**
 * Save or update officer push token in notificationpushtoken table
 */
async function saveOfficerPushToken(officerId, pushToken, tokenType = "fcm", deviceType = "android") {
  if (!officerId || !pushToken) {
    throw new Error("officerId and pushToken are required");
  }

  const sql = `
    INSERT INTO notificationpushtoken (officerId, pushToken, tokenType, deviceType, updatedAt)
    VALUES (?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      tokenType = VALUES(tokenType),
      deviceType = VALUES(deviceType),
      updatedAt = NOW()
  `;

  return new Promise((resolve, reject) => {
    collectionofficer.query(sql, [officerId, pushToken, tokenType, deviceType], (err, result) => {
      if (err) {
        console.error("❌ [PushService] Error saving push token:", err);
        return reject(err);
      }
      console.log(`✅ [PushService] Push token saved for officerId: ${officerId} (Type: ${tokenType})`);
      resolve(result);
    });
  });
}

/**
 * Remove an invalid/expired token from the database
 */
function removeToken(pushToken) {
  const sql = "DELETE FROM notificationpushtoken WHERE pushToken = ?";
  collectionofficer.query(sql, [pushToken], (err) => {
    if (err) console.error("Error removing expired push token:", err);
    else console.log("Removed expired/unregistered push token:", pushToken);
  });
}

/**
 * Send push notification to all active devices of an officer
 */
async function sendPushToOfficer(officerId, { title, body, data = {} }) {
  if (!officerId) return;

  const getTokensSql = `
    SELECT pushToken, tokenType, deviceType 
    FROM notificationpushtoken 
    WHERE officerId = ?
  `;

  return new Promise((resolve) => {
    collectionofficer.query(getTokensSql, [officerId], async (err, rows) => {
      if (err) {
        console.error("❌ [PushService] Error fetching push tokens for officer:", err);
        return resolve({ success: false, error: err.message });
      }

      if (!rows || rows.length === 0) {
        console.log(`ℹ️ [PushService] No registered push tokens found for officerId: ${officerId}`);
        return resolve({ success: true, count: 0 });
      }

      console.log(`📢 [PushService] Found ${rows.length} token(s) for officerId: ${officerId}. Sending push...`);

      const fbMessaging = initFirebase();
      const stringifiedData = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = typeof value === "string" ? value : JSON.stringify(value);
      }

      const results = [];

      for (const row of rows) {
        const { pushToken, tokenType } = row;

        // 1. Expo Push Token handling
        if (tokenType === "expo" || pushToken.startsWith("ExponentPushToken") || pushToken.startsWith("ExpoPushToken")) {
          try {
            const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                title: title,
                body: body,
                sound: "default",
                priority: "high",
                channelId: "dcm-otp-notifications",
                data: stringifiedData,
              }),
            });
            const expoResult = await expoResponse.json();
            console.log(`📱 [PushService] Expo Push response for token ${pushToken.slice(0, 15)}...:`, expoResult);
            results.push({ token: pushToken, success: true, type: "expo" });
          } catch (expoErr) {
            console.error("❌ [PushService] Expo push error:", expoErr.message);
            results.push({ token: pushToken, success: false, error: expoErr.message });
          }
          continue;
        }

        // 2. Native FCM Token handling via Firebase Admin
        if (fbMessaging) {
          try {
            const message = {
              token: pushToken,
              notification: {
                title: title,
                body: body,
              },
              data: stringifiedData,
              android: {
                priority: "high",
                notification: {
                  channelId: "dcm-otp-notifications",
                  sound: "default",
                  color: "#980775",
                  priority: "max",
                  defaultVibrateTimings: true,
                  visibility: "public",
                },
              },
            };

            const response = await fbMessaging.send(message);
            console.log(`🔥 [PushService] FCM message sent successfully! MessageId: ${response}`);
            results.push({ token: pushToken, success: true, messageId: response });
          } catch (fcmErr) {
            console.error("❌ [PushService] FCM send error:", fcmErr.message);
            if (
              fcmErr.code === "messaging/registration-token-not-registered" ||
              fcmErr.code === "messaging/invalid-registration-token"
            ) {
              removeToken(pushToken);
            }
            results.push({ token: pushToken, success: false, error: fcmErr.message });
          }
        } else {
          console.warn("⚠️ [PushService] Firebase Messaging not initialized; skipped FCM send for token:", pushToken.slice(0, 15));
        }
      }

      resolve({ success: true, count: results.length, results });
    });
  });
}

module.exports = {
  initFirebase,
  saveOfficerPushToken,
  sendPushToOfficer,
};
