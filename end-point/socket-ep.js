const userDao = require("../dao/userAuth-dao");
const userSockets = new Map();

exports.handleConnection = (socket) => {
  socket.on("login", async (data) => {
    const startTime = Date.now();

    // Validate input data
    if (!data || typeof data !== "object" || !data.empId) {
      console.error("Invalid data format received:", data);
      socket.emit("loginError", "Invalid data format");
      return;
    }

    const empId = data.empId;
    const empIdAsString =
      typeof empId === "string" ? empId.trim() : empId.toString();

    if (userSockets.has(socket.id)) {
      socket.emit("loginSuccess", { empId: empId, timestamp: data.timestamp });
      return;
    }

    userSockets.set(socket.id, empId);

    socket.emit("loginSuccess", { empId: empId, timestamp: data.timestamp });

    socket.broadcast.emit("employeeOnline", { empId: empId });

    try {
      await userDao.updateOnlineStatusWithSocket(empIdAsString, true);
    } catch (err) {
      console.error("Error updating employee online status:", err);
    }
  });

  socket.on("disconnect", async () => {
    const empId = userSockets.get(socket.id);
    if (!empId) return;

    socket.broadcast.emit("employeeOffline", { empId });

    userSockets.delete(socket.id);

    const empIdAsString =
      typeof empId === "string" ? empId.trim() : empId.toString();

    try {
      await userDao.updateOnlineStatusWithSocket(empIdAsString, false);
    } catch (err) {
      console.error("Error updating employee offline status:", err);
    }
  });
};
