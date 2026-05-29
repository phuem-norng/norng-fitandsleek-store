<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\Media;
use Cloudinary\Cloudinary as CloudinarySdk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use RuntimeException;

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
        $profileDisk = (string) env('ADMIN_PROFILE_IMAGE_DISK', Media::disk());
        $preset = trim((string) env('CLOUDINARY_UPLOAD_PRESET', ''));

        if (! is_array(config("filesystems.disks.{$profileDisk}"))) {
            $profileDisk = Media::disk();
        }

        if ($user->profile_image_path) {
            Media::delete($user->profile_image_path);
        }

        $file = $request->file('profile_image');
        $filename = 'admin_profile_'.$user->id.'_'.time().'.'.$file->getClientOriginalExtension();
        try {
            if ($profileDisk === 'cloudinary' && $preset !== '') {
                $cloudName = trim((string) env('CLOUDINARY_CLOUD_NAME', ''));
                $apiKey = trim((string) env('CLOUDINARY_API_KEY', ''));
                $apiSecret = trim((string) env('CLOUDINARY_API_SECRET', ''));
                $cloudinaryUrl = trim((string) env('CLOUDINARY_URL', ''));

                if ($cloudName === '' || $apiKey === '' || ($apiSecret === '' && $preset === '')) {
                    if ($cloudinaryUrl !== '') {
                        $parts = parse_url($cloudinaryUrl);
                        $cloudName = $cloudName !== '' ? $cloudName : trim((string) ($parts['host'] ?? ''));
                        $apiKey = $apiKey !== '' ? $apiKey : trim((string) ($parts['user'] ?? ''));
                        $apiSecret = $apiSecret !== '' ? $apiSecret : trim((string) ($parts['pass'] ?? ''));
                    }
                }

                if ($cloudName === '' || ($apiKey === '' && $preset === '') || ($apiSecret === '' && $preset === '')) {
                    throw new RuntimeException('Cloudinary credentials are incomplete.');
                }

                $uploadOptions = ['folder' => 'profile_images'];
                $uploadOptions['resource_type'] = 'image';
                if ($preset !== '') {
                    // Unsigned upload flow: does not require API secret/signature.
                    $unsignedCloudinary = $cloudinaryUrl !== ''
                        ? new CloudinarySdk($cloudinaryUrl)
                        : new CloudinarySdk(['cloud' => ['cloud_name' => $cloudName], 'url' => ['secure' => true]]);
                    $uploadResult = $unsignedCloudinary->uploadApi()->unsignedUpload($file->getRealPath(), $preset, $uploadOptions);
                } else {
                    // Signed upload flow: requires key + secret.
                    $uploadOptions['public_id'] = pathinfo($filename, PATHINFO_FILENAME);
                    $uploadOptions['overwrite'] = true;
                    $signedCloudinary = new CloudinarySdk([
                        'cloud' => ['cloud_name' => $cloudName],
                        'api' => ['api_key' => $apiKey, 'api_secret' => $apiSecret],
                        'url' => ['secure' => true],
                    ]);
                    $uploadResult = $signedCloudinary->uploadApi()->upload($file->getRealPath(), $uploadOptions);
                }
                $path = (string) ($uploadResult['secure_url'] ?? '');
                if ($path === '') {
                    throw new RuntimeException('Cloudinary upload did not return secure_url.');
                }
            } else {
                $path = Media::storeUploadedAs($file, 'profile_images', $filename, $profileDisk);
            }
        } catch (\Throwable $e) {
            $errorContext = [
                'admin_id' => $user->id,
                'preferred_disk' => $profileDisk,
                'fallback_to_public' => Media::fallbackToPublic(),
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ];
            Log::error('Admin profile image upload failed on preferred disk.', $errorContext);
            Log::channel('stderr')->error('Admin profile image upload failed on preferred disk.', $errorContext);

            if (! Media::fallbackToPublic()) {
                $debugEnabled = filter_var(env('ADMIN_PROFILE_IMAGE_DEBUG', false), FILTER_VALIDATE_BOOL);

                return response()->json([
                    'success' => false,
                    'message' => 'Image upload storage is unavailable. Please retry shortly.',
                    'debug_message' => $debugEnabled ? $e->getMessage() : null,
                ], 503);
            }

            $path = Media::storeUploadedAs($file, 'profile_images', $filename, 'public');
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

