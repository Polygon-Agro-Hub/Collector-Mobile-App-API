const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Socket.IO JWT authentication middleware (matching Govi Transport pattern)
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
        socket.handshake.query?.token;

      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "default_jwt_secret_key"
          );
          socket.userId = decoded.id;
          socket.empId = decoded.empId;
          socket.user = decoded;
        } catch (jwtErr) {
          console.warn("[Socket] Token verification warning:", jwtErr.message);
        }
      }
      return next();
    } catch (err) {
      console.error("[Socket] Auth middleware error:", err);
      return next();
    }
  });

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log(
      `🔌 [Socket] Client connected: ${socket.id}, userId: ${
        socket.userId || "anonymous"
      }, empId: ${socket.empId || "none"}`
    );

    const officerStatusCache = require("../services/officer-status-cache");

    // Helper to kick rejected users immediately upon socket connect or room join
    const checkAndKickRejected = (id) => {
      if (id && officerStatusCache.isRejected(Number(id))) {
        const payload = {
          status: "Rejected",
          accountStatus: "Rejected",
          statusType: "rejected",
          message: "This EMP ID is Rejected",
          timestamp: new Date().toISOString(),
        };
        socket.emit("officer_status_changed", payload);
        socket.emit("account_status_changed", payload);
        console.log(
          `⛔ [Socket Security] Proactively kicked rejected user ${id} on socket ${socket.id}`
        );
        return true;
      }
      return false;
    };

    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
      console.log(`👤 [Socket] Socket ${socket.id} joined room user_${socket.userId}`);
      checkAndKickRejected(socket.userId);
    }
    if (socket.empId) {
      socket.join(`user_${socket.empId}`);
      console.log(`👤 [Socket] Socket ${socket.id} joined room user_${socket.empId}`);
    }

    socket.on("join_row", (rowId) => {
      socket.join(`row_${rowId}`);
      console.log(`Socket ${socket.id} joined room row_${rowId}`);
    });

    socket.on("join_user", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 [Socket] Socket ${socket.id} joined room user_${userId}`);
      checkAndKickRejected(userId);
    });

    socket.on("join_officer", (officerId) => {
      socket.join(`user_${officerId}`);
      console.log(`👤 [Socket] Socket ${socket.id} joined room user_${officerId}`);
      checkAndKickRejected(officerId);
    });

    socket.on("register_user", async (data) => {
      let targetUserId = null;
      let targetEmpId = null;
      let token = null;

      if (typeof data === "object" && data !== null) {
        targetUserId = data.userId;
        targetEmpId = data.empId;
        token = data.token;
      } else {
        targetUserId = data;
      }

      if (token && (!socket.userId || !socket.empId)) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "default_jwt_secret_key"
          );
          socket.userId = decoded.id;
          socket.empId = decoded.empId;
          socket.user = decoded;
        } catch (tokenErr) {
          console.warn("[Socket Security] Token verification failed on register_user:", tokenErr.message);
        }
      }

      const effectiveId = targetUserId || socket.userId;
      const effectiveEmpId = targetEmpId || socket.empId;

      if (effectiveId) {
        socket.join(`user_${effectiveId}`);
        console.log(`👤 [Socket] Socket ${socket.id} joined room user_${effectiveId}`);
      }
      if (effectiveEmpId) {
        socket.join(`user_${effectiveEmpId}`);
        console.log(`👤 [Socket] Socket ${socket.id} joined room user_${effectiveEmpId}`);
      }

      if (effectiveId && checkAndKickRejected(effectiveId)) {
        return;
      }
    });

    socket.on("update_officer_status", (data) => {
      const targetId = data?.officerId || data?.userId;
      const empId = data?.empId;
      const rooms = new Set();
      if (targetId) rooms.add(`user_${targetId}`);
      if (empId) rooms.add(`user_${empId}`);

      rooms.forEach((room) => {
        io.to(room).emit("officer_status_changed", data);
        io.to(room).emit("account_status_changed", data);
        console.log(`📢 [Socket] Officer status changed emitted to ${room}:`, data);
      });
    });

    socket.on("force_logout_user", (data) => {
      const targetId = data?.userId || data?.officerId;
      const empId = data?.empId;
      const rooms = new Set();
      if (targetId) rooms.add(`user_${targetId}`);
      if (empId) rooms.add(`user_${empId}`);

      rooms.forEach((room) => {
        io.to(room).emit("force_logout", data);
        console.log(`🔒 [Socket] Force logout emitted to ${room}:`, data);
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

/**
 * Emit officer account status change (e.g. Banned / Rejected / Not Approved).
 * Matches Govi Transport emitUserStatusChanged pattern.
 */
const emitOfficerStatusChanged = (userIdentifiers, statusData = {}) => {
  if (!io) {
    console.warn("[Socket] IO not initialized, cannot emit officer status changed");
    return false;
  }

  const rawList = Array.isArray(userIdentifiers)
    ? [...userIdentifiers]
    : [userIdentifiers];

  if (statusData.userId) rawList.push(statusData.userId);
  if (statusData.empId) rawList.push(statusData.empId);

  const rooms = [
    ...new Set(
      rawList
        .filter(Boolean)
        .map((id) => (String(id).startsWith("user_") ? String(id) : `user_${id}`))
    ),
  ];

  if (rooms.length === 0) {
    console.warn("[Socket] No valid target rooms for officer status changed");
    return false;
  }

  const payload = {
    status: statusData.status,
    accountStatus: statusData.status,
    statusType:
      statusData.statusType ||
      (statusData.status || "").toLowerCase().replace(/\s+/g, "_"),
    message:
      statusData.message ||
      (statusData.status === "Rejected"
        ? "Your account has been rejected by administration."
        : `Your account status has changed to ${statusData.status}.`),
    timestamp: new Date().toISOString(),
    ...statusData,
  };

  rooms.forEach((room) => {
    io.to(room).emit("officer_status_changed", payload);
    io.to(room).emit("account_status_changed", payload);
    io.to(room).emit("user_status_changed", payload);
  });
  console.log(`📢 [Socket] Emitted officer status changed to ${rooms.join(", ")}:`, payload);

  if (statusData.status === "Rejected") {
    setTimeout(() => {
      rooms.forEach((room) => {
        io.in(room).disconnectSockets(true);
        console.log(`[Socket] Forcibly disconnected sockets in ${room}`);
      });
    }, 1200);
  }

  return true;
};

/**
 * Emit Return OTP Notification to DCM
 */
const emitReturnOtpNotification = (officerIdentifiers, payload) => {
  if (!io) {
    console.warn("[Socket] IO not initialized, cannot emit return OTP");
    return false;
  }

  const rawList = Array.isArray(officerIdentifiers)
    ? [...officerIdentifiers]
    : [officerIdentifiers];

  const rooms = [
    ...new Set(
      rawList
        .filter(Boolean)
        .map((id) => (String(id).startsWith("user_") ? String(id) : `user_${id}`))
    ),
  ];

  if (rooms.length > 0) {
    rooms.forEach((room) => {
      io.to(room).emit("new_return_otp", payload);
      io.to(room).emit("handover_return_otp", payload);
      io.to(room).emit("new_notification", payload);
      io.to(room).emit("newNotification", payload);
    });
    console.log(`📢 [Socket] Emitted real-time return OTP to ${rooms.join(", ")}:`, payload);
  } else {
    io.emit("new_return_otp", payload);
    io.emit("new_notification", payload);
  }

  return true;
};

module.exports = {
  initSocket,
  getIO,
  emitOfficerStatusChanged,
  emitReturnOtpNotification,
};
