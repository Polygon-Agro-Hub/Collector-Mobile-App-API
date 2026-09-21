/**
 * Centralized Packing Time Slot Constants & Formatter for Backend
 */
const TIME_SLOT_MAP = {
  "8-12": "08:00 AM - 12:00 PM",
  "12-16": "12:00 PM - 04:00 PM",
  "12-4": "12:00 PM - 04:00 PM",
  "16-20": "04:00 PM - 09:00 PM",
  "16-21": "04:00 PM - 09:00 PM",
  "4-9": "04:00 PM - 09:00 PM",
};

/**
 * Formats raw timeSlot key into standard human-readable label
 * (Restricted to 3 standard formats: 08:00 AM - 12:00 PM, 12:00 PM - 04:00 PM, 04:00 PM - 09:00 PM)
 * @param {string|null|undefined} timeSlot 
 * @returns {string}
 */
const formatTimeSlot = (timeSlot) => {
  if (!timeSlot) return "";
  return TIME_SLOT_MAP[timeSlot] || timeSlot;
};

module.exports = {
  TIME_SLOT_MAP,
  formatTimeSlot,
};
