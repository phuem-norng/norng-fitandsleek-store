import React, { useState } from "react";
import apiClient from "../../lib/api";

export default function AdminManagement() {
 const [loading, setLoading] = useState(false);
 const [formData, setFormData] = useState({
 name: "",
 email: "",
 password: "",
 password_confirmation: "",
 role: "admin",
 phone: "",
 address: "",
 });
 const [errors, setErrors] = useState({});
 const [successMessage, setSuccessMessage] = useState("");

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData((prev) => ({
 ...prev,
 [name]: value,
 }));
 // Clear error for this field
 if (errors[name]) {
 setErrors((prev) => ({
 ...prev,
 [name]: "",
 }));
 }
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);
 setErrors({});
 setSuccessMessage("");

 try {
 const response = await apiClient.post(
 "/admin/superadmin/admin-users",
 formData
 );

 setSuccessMessage("Admin user created successfully!");
 setFormData({
 name: "",
 email: "",
 password: "",
 password_confirmation: "",
 role: "admin",
 phone: "",
 address: "",
 });

 // Clear success message after 3 seconds
 setTimeout(() => setSuccessMessage(""), 3000);
 } catch (error) {
 if (error.response?.data?.errors) {
 setErrors(error.response.data.errors);
 } else if (error.response?.data?.message) {
 setErrors({ general: error.response.data.message });
 } else {
 setErrors({ general: "Failed to create admin user" });
 }
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="space-y-6 w-full min-w-0">
 {/* Header */}
 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
 <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
 Create New Team User
 </h2>
 <p className="text-slate-600 dark:text-slate-400">
 Create admin accounts to manage operations.
 </p>
 </div>

 {/* Form Card */}
 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8">
 {successMessage && (
 <div className="mb-6 p-4 bg-[rgba(var(--admin-primary-rgb),0.12)] dark:bg-[rgba(var(--admin-primary-rgb),0.18)] border border-[rgba(var(--admin-primary-rgb),0.35)] rounded-lg text-[color:var(--admin-primary)] dark:text-white">
 {successMessage}
 </div>
 )}

 {errors.general && (
 <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-800 dark:text-red-400">
 {errors.general}
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Name */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Full Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 name="name"
 value={formData.name}
 onChange={handleChange}
 placeholder="John Doe"
 className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-colors ${errors.name
 ? "border-red-500 dark:border-red-500"
 : "border-slate-300 dark:border-slate-600 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)]"
 } focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]`}
 />
 {errors.name && (
 <p className="mt-1 text-sm text-red-500">{errors.name}</p>
 )}
 </div>

 {/* Email */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Email Address <span className="text-red-500">*</span>
 </label>
 <input
 type="email"
 name="email"
 value={formData.email}
 onChange={handleChange}
 placeholder="admin@example.com"
 className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-colors ${errors.email
 ? "border-red-500 dark:border-red-500"
 : "border-slate-300 dark:border-slate-600 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)]"
 } focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]`}
 />
 {errors.email && (
 <p className="mt-1 text-sm text-red-500">{errors.email}</p>
 )}
 </div>

 {/* Password */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Password <span className="text-red-500">*</span>
 </label>
 <input
 type="password"
 name="password"
 value={formData.password}
 onChange={handleChange}
 placeholder="••••••••"
 className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-colors ${errors.password
 ? "border-red-500 dark:border-red-500"
 : "border-slate-300 dark:border-slate-600 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)]"
 } focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]`}
 />
 {errors.password && (
 <p className="mt-1 text-sm text-red-500">{errors.password}</p>
 )}
 </div>

 {/* Password Confirmation */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Confirm Password <span className="text-red-500">*</span>
 </label>
 <input
 type="password"
 name="password_confirmation"
 value={formData.password_confirmation}
 onChange={handleChange}
 placeholder="••••••••"
 className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 transition-colors ${errors.password_confirmation
 ? "border-red-500 dark:border-red-500"
 : "border-slate-300 dark:border-slate-600 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)]"
 } focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]`}
 />
 {errors.password_confirmation && (
 <p className="mt-1 text-sm text-red-500">
 {errors.password_confirmation}
 </p>
 )}
 </div>

 {/* Role */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Role <span className="text-red-500">*</span>
 </label>
 <select
 name="role"
 value={formData.role}
 onChange={handleChange}
 className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-colors ${errors.role
 ? "border-red-500 dark:border-red-500"
 : "border-slate-300 dark:border-slate-600 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)]"
 } focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]`}
 >
 <option value="admin">Admin</option>
 </select>
 {errors.role && (
 <p className="mt-1 text-sm text-red-500">{errors.role}</p>
 )}
 </div>

 {/* Phone */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Phone Number (Optional)
 </label>
 <input
 type="tel"
 name="phone"
 value={formData.phone}
 onChange={handleChange}
 placeholder="+1 (555) 000-0000"
 className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] transition-colors"
 />
 </div>

 {/* Address */}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
 Address (Optional)
 </label>
 <input
 type="text"
 name="address"
 value={formData.address}
 onChange={handleChange}
 placeholder="123 Main St"
 className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:border-[var(--admin-primary)] dark:focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] transition-colors"
 />
 </div>
 </div>

 {/* Submit Button */}
 <div className="flex gap-4 pt-6">
 <button
 type="submit"
 disabled={loading}
 className="flex-1 px-6 py-3 bg-[color:var(--admin-primary)] hover:brightness-110 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-all duration-300 disabled:cursor-not-allowed disabled:hover:brightness-100"
 >
 {loading ? "Creating User..." : "Create Team User"}
 </button>
 </div>
 </form>
 </div>

 {/* Info Box */}
 <div className="bg-[rgba(var(--admin-primary-rgb),0.08)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] border border-[rgba(var(--admin-primary-rgb),0.28)] dark:border-[rgba(var(--admin-primary-rgb),0.4)] rounded-2xl p-6">
 <h3 className="font-bold text-slate-900 dark:text-white mb-3">
 Important Information
 </h3>
 <ul className="space-y-2 text-slate-700 dark:text-slate-200 text-sm">
 <li className="flex items-start gap-3">
 <svg
 className="w-5 h-5 mt-0.5 flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 <span>
 <strong>Password Requirements:</strong> Minimum 8 characters
 </span>
 </li>
 <li className="flex items-start gap-3">
 <svg
 className="w-5 h-5 mt-0.5 flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 <span>
 <strong>Email Uniqueness:</strong> Each user must have a unique
 email address
 </span>
 </li>
 <li className="flex items-start gap-3">
 <svg
 className="w-5 h-5 mt-0.5 flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 <span>
 <strong>Roles:</strong> Admins can manage operations and storefront configuration.
 </span>
 </li>
 <li className="flex items-start gap-3">
 <svg
 className="w-5 h-5 mt-0.5 flex-shrink-0"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
 clipRule="evenodd"
 />
 </svg>
 <span>
 <strong>Share Credentials Securely:</strong> Provide the new user
 with login credentials through a secure channel
 </span>
 </li>
 </ul>
 </div>
 </div>
 );
}
