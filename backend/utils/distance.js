/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance charge multiplier based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Price multiplier (0-2)
 */
function getDistanceMultiplier(distanceKm) {
  if (distanceKm <= 5) return 0.8;      // Near: 20% discount
  if (distanceKm <= 15) return 1.0;     // Medium: No additional charge
  if (distanceKm <= 25) return 1.3;     // Far: 30% extra
  return 1.5;                           // Very far: 50% extra
}

/**
 * Calculate final price based on base price and distance
 * @param {number} basePrice - Base service price
 * @param {number} distanceKm - Distance in kilometers
 * @returns {object} { finalPrice, distanceCharge, multiplier }
 */
function calculateFinalPrice(basePrice, distanceKm) {
  const multiplier = getDistanceMultiplier(distanceKm);
  const distanceCharge = basePrice * (multiplier - 1);
  const finalPrice = basePrice + distanceCharge;
  
  return {
    finalPrice: Math.round(finalPrice),
    distanceCharge: Math.round(distanceCharge),
    multiplier
  };
}

module.exports = {
  calculateDistance,
  getDistanceMultiplier,
  calculateFinalPrice
};
