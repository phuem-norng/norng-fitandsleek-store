/**
 * Optional GPS for delivery/checkout only — never used at login.
 * User must tap a button; no background tracking.
 */

export function requestDeliveryPin({ onSuccess, onError }) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new Error("Geolocation is not supported in this browser."));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess?.({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    (err) => {
      onError?.(err || new Error("Unable to fetch your current location."));
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}
