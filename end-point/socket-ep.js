


const userDao = require('../dao/userAuth-dao');
const userSockets = new Map(); // Store empId by socket.id

exports.handleConnection = (socket) => {
  console.log(`${socket.id} user connected`);

  // Handle 'login' event to mark user as online
  socket.on("login", async (data) => {
    const startTime = Date.now();
    console.log("Login data received:", JSON.stringify(data));

    // Validate input data
    if (!data || typeof data !== 'object' || !data.empId) {
      console.error('Invalid data format received:', data);
      socket.emit('loginError', 'Invalid data format');
      return;
    }

    const empId = data.empId;
    const empIdAsString = typeof empId === 'string' ? empId.trim() : empId.toString();
    console.log(`Processing login for Employee ID: ${empIdAsString}`);

    // Check if the socket is already logged in
    if (userSockets.has(socket.id)) {
      console.log(`Socket ${socket.id} is already logged in.`);
      socket.emit('loginSuccess', { empId: empId, timestamp: data.timestamp }); // Send success anyway
      return; // Prevent double login
    }

    // Store empId in userSockets map immediately
    userSockets.set(socket.id, empId);

    // Send confirmation to the client immediately (non-blocking)
    socket.emit('loginSuccess', { empId: empId, timestamp: data.timestamp });

    // Emit an event to inform other users of the new user online
    socket.broadcast.emit("employeeOnline", { empId: empId });

    // Update online status in the database (non-blocking)
    try {
      await userDao.updateOnlineStatusWithSocket(empIdAsString, true);
      console.log(`Employee ${empId} marked as online in the database. Took ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error("Error updating employee online status:", err);
      // Don't send loginError here since we already sent loginSuccess
    }
  });

  // When the user disconnects, mark them as offline
  socket.on("disconnect", async () => {
    const empId = userSockets.get(socket.id);
    if (!empId) return; // Exit early if no empId found

    console.log(`Employee ${empId} disconnected`);

    // Emit offline event immediately before database update
    socket.broadcast.emit("employeeOffline", { empId });

    // Remove from map immediately
    userSockets.delete(socket.id);

    // Convert to string if needed
    const empIdAsString = typeof empId === 'string' ? empId.trim() : empId.toString();

    // Update database (non-blocking)
    try {
      await userDao.updateOnlineStatusWithSocket(empIdAsString, false);
      console.log(`Employee ${empId} marked as offline in the database.`);
    } catch (err) {
      console.error("Error updating employee offline status:", err);
    }
  });
};