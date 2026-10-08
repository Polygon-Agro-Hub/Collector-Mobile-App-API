const axios = require("axios");

/**
 * Service to notify Polygon Mobile API over HTTP webhook.
 * This triggers real-time Socket.IO events (new_notification, notification_unread_count)
 * and Firebase Push Notifications directly to the customer's mobile device (Zero Polling).
 */

const getPolygonBaseUrl = () => {
  const url = process.env.POLYGON_API_URL || "https://dev-mob-api.polygon.lk/polygon";
  return url.replace(/\/+$/, "");
};

const { POLYGON_TRIGGER_SECRET } = require("../constants/notification-secrets");

const getServiceHeaders = () => {
  const secret = POLYGON_TRIGGER_SECRET;
  const headers = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["x-service-token"] = secret;
    headers["Authorization"] = `Bearer ${secret}`;
  }
  return headers;
};

/**
 * Dispatches a notification to Polygon customer via Polygon API webhook.
 * Non-blocking: will never crash or block the caller if Polygon API is slow or unreachable.
 */
const triggerPolygonNotification = async ({
  orderId,
  title,
  message,
  eventType,
  data = {},
  skipDbInsert = true,
}) => {
  if (!orderId) {
    console.warn("[Polygon Notification] orderId is required to trigger notification.");
    return false;
  }

  const polygonBase = getPolygonBaseUrl();
  const url = `${polygonBase}/api/notification/trigger`;

  try {
    const payload = {
      orderId,
      title,
      message,
      eventType,
      data,
      skipDbInsert,
    };

    const response = await axios.post(url, payload, {
      timeout: 5000,
      headers: getServiceHeaders(),
    });

    console.log(
      `📢 [Polygon Socket] Dispatched "${title}" for order ${orderId} (Status: ${response.status})`
    );
    return true;
  } catch (err) {
    console.warn(
      `⚠️ [Polygon Socket] Could not dispatch notification to Polygon API (${url}) for order ${orderId}:`,
      err.response?.data?.message || err.message
    );
    return false;
  }
};

/**
 * QC verification & packaging completed at distribution center
 * Matches exact structure saved in ordernotfication table (Title, message)
 */
const notifyOrderPacked = async (processOrderId, invNo, customTitle, customMessage) => {
  const defaultTitle = "Order is Out for Delivery";
  const defaultMessage = `Your order #${invNo} has been packed, quality checked, and is now out for delivery.`;
  return triggerPolygonNotification({
    orderId: processOrderId,
    title: customTitle || defaultTitle,
    message: customMessage || defaultMessage,
    eventType: "order_packed",
    data: { processOrderId, invNo },
    skipDbInsert: true,
  });
};

/**
 * Order assigned to transport vehicle and ready for dispatch
 */
const notifyOrderDispatched = async (processOrderId, invNo) => {
  return triggerPolygonNotification({
    orderId: processOrderId,
    title: "Order Dispatched",
    message: `Your order #${invNo} has been dispatched from the distribution center.`,
    eventType: "order_dispatched",
    data: { processOrderId, invNo },
    skipDbInsert: true,
  });
};

module.exports = {
  triggerPolygonNotification,
  notifyOrderPacked,
  notifyOrderDispatched,
};
