<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    protected $fillable = [
        'page','sort_order','title','subtitle','image_url','link_url',
        'position','audience_targets','audience_priority_map','is_active','order',
        'show_badge','show_title','show_subtitle','show_cta',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'order' => 'integer',
        'show_badge' => 'boolean',
        'show_title' => 'boolean',
        'show_subtitle' => 'boolean',
        'show_cta' => 'boolean',
        'audience_targets' => 'array',
        'audience_priority_map' => 'array',
    ];
}
