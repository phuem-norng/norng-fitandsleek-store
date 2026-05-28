<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Get admin profile
     */
    public function show(Request $request)
    {
        $user = $request->user();
        
        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'address' => $user->address,
                'role' => $user->role,
                'created_at' => $user->created_at,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }
    
    /**
     * Update admin profile
     */
    public function update(Request $request)
    {
        $user = $request->user();
        
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                Rule::unique('users')->ignore($user->id),
            ],
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
        ]);
        
        $user->update($validated);
        
        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'address' => $user->address,
                'role' => $user->role,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }
    
    /**
     * Update password
     */
    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);
        
        $user = $request->user();
        
        // Verify current password
        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect',
            ], 422);
        }
        
        // Update password
        $user->update([
            'password' => Hash::make($validated['password']),
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully',
        ]);
    }

    /**
     * Upload profile image
     */
    public function uploadImage(Request $request)
    {
        $request->validate([
            'profile_image' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120', // 5MB max
        ]);

        $user = $request->user();
        $profileDisk = (string) env('ADMIN_PROFILE_IMAGE_DISK', 'cloudinary');
        $fallbackToPublic = filter_var(
            env('ADMIN_PROFILE_IMAGE_FALLBACK_TO_PUBLIC', env('APP_ENV') !== 'production'),
            FILTER_VALIDATE_BOOL
        );

        if (!is_array(config("filesystems.disks.{$profileDisk}"))) {
            $profileDisk = (string) config('filesystems.default', 'public');
        }

        // Delete old image if exists
        if ($user->profile_image_path) {
            foreach (array_unique([$profileDisk, 'cloudinary', 'public']) as $disk) {
                try {
                    Storage::disk($disk)->delete($user->profile_image_path);
                } catch (\Throwable) {
                    // Best-effort cleanup for legacy paths from other disks.
                }
            }
        }

        // Store new image with safe fallback when preferred disk is unavailable.
        $file = $request->file('profile_image');
        $filename = 'admin_profile_' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
        try {
            if ($profileDisk === 'cloudinary') {
                $uploadOptions = [
                    'folder' => 'profile_images',
                    'public_id' => pathinfo($filename, PATHINFO_FILENAME),
                    'overwrite' => true,
                    'resource_type' => 'image',
                ];

                $preset = trim((string) env('CLOUDINARY_UPLOAD_PRESET', ''));
                if ($preset !== '') {
                    $uploadOptions['upload_preset'] = $preset;
                }

                // Use Cloudinary SDK directly to avoid adapter-specific failures on Render.
                $uploadResult = Cloudinary::upload($file->getRealPath(), $uploadOptions);
                $path = (string) $uploadResult->getSecurePath();
            } else {
                $path = $file->storeAs('profile_images', $filename, $profileDisk);
            }
        } catch (\Throwable $e) {
            Log::error('Admin profile image upload failed on preferred disk.', [
                'admin_id' => $user->id,
                'preferred_disk' => $profileDisk,
                'fallback_to_public' => $fallbackToPublic,
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]);

            if (! $fallbackToPublic) {
                return response()->json([
                    'success' => false,
                    'message' => 'Image upload storage is unavailable. Please retry shortly.',
                ], 503);
            }

            $path = $file->storeAs('profile_images', $filename, 'public');
        }
        
        // Update user
        $user->update([
            'profile_image_path' => $path,
        ]);
        $user->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Profile image uploaded successfully',
            'profile_image_url' => $user->profile_image_url,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }
}

