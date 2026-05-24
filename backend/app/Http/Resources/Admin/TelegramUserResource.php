<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TelegramUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $linked = !empty($this->user_id);

        return [
            'id' => $this->id,
            'telegram_user_id' => $this->telegram_user_id,
            'chat_id' => $this->chat_id,
            'username' => $this->username,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'language_code' => $this->language_code,
            'last_message_text' => $this->last_message_text,
            'last_interacted_at' => optional($this->last_interacted_at)?->toISOString(),
            'linked' => $linked,
            'link_status' => $linked ? 'linked' : 'unlinked',
            'user' => $this->whenLoaded('user', function () {
                if (!$this->user) {
                    return null;
                }

                return [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'email' => $this->user->email,
                    'phone' => $this->user->phone,
                    'role' => $this->user->role,
                ];
            }),
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
        ];
    }
}
