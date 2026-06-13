/** Extract first Laravel validation message from an API error. */
export function getAdminValidationMessage(error) {
  const responseMessage = error?.response?.data?.message;
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors).flat().find(Boolean);
    return first || responseMessage || "Validation failed.";
  }
  return responseMessage || error?.message || "Request failed.";
}
