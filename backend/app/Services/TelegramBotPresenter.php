<?php

namespace App\Services;

class TelegramBotPresenter
{
    public const BRAND = 'Fit & Sleek';

    public function divider(): string
    {
        return '────────────────';
    }

    public function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }

    public function productPhotoCaption(string $name, float $price, string $productUrl = ''): string
    {
        $lines = [
            '<b>'.$this->escape($name).'</b>',
            '💵 $'.number_format($price, 2),
        ];

        if ($productUrl !== '') {
            $safeUrl = htmlspecialchars($productUrl, ENT_QUOTES, 'UTF-8');
            $lines[] = '';
            $lines[] = '<a href="'.$safeUrl.'">🛒 View product</a>';
        } else {
            $lines[] = '';
            $lines[] = 'Tap the button below to open in store.';
        }

        return implode("\n", $lines);
    }

    public function productsIntro(): string
    {
        return implode("\n", [
            '🛍️ <b>Featured for you</b>',
            '',
            $this->divider(),
            'Swipe the gallery below · tap <b>View product</b> on each item.',
        ]);
    }

    public function searchPrompt(): string
    {
        return implode("\n", [
            '🔍 <b>Smart product search</b>',
            '',
            $this->divider(),
            '<b>How to search</b>',
            '• Type any keyword (name, brand, category)',
            '• Tap a quick suggestion below',
            '• Browse by category',
            '• Command: <code>/search nike</code>',
            '',
            '<b>Smart matching</b>',
            'Case-insensitive · brand · category · typo-friendly',
            $this->divider(),
        ]);
    }

    public function searchResultsHeader(string $query, int $count): string
    {
        $q = $this->escape($query);

        return implode("\n", [
            '🔍 <b>Search results</b>',
            "Query: <code>{$q}</code>",
            "Found: <b>{$count}</b>",
            $this->divider(),
        ]);
    }

    public function searchNoResults(string $query): string
    {
        return implode("\n", [
            '🔍 <b>No products found</b>',
            '',
            $this->divider(),
            'Nothing matched "<code>'.$this->escape($query).'</code>".',
            '',
            'Try: shorter words, brand name, or category buttons.',
            'Example: <code>belt</code>, <code>cardigan</code>, <code>nike</code>',
            $this->divider(),
        ]);
    }

    public function categoryBrowseHeader(): string
    {
        return implode("\n", [
            '📂 <b>Browse by category</b>',
            '',
            $this->divider(),
            'Tap a category to see products:',
        ]);
    }

    public function orderStatusBadge(string $status): string
    {
        $key = strtolower(trim($status));

        return match ($key) {
            'pending' => '🟡 Pending',
            'processing', 'confirmed' => '🔵 Processing',
            'shipped', 'in_transit' => '🚚 Shipped',
            'delivered', 'completed' => '✅ Delivered',
            'cancelled', 'canceled' => '❌ Cancelled',
            default => '⚪ '.ucfirst($key ?: 'Unknown'),
        };
    }

    public function welcomeLinked(string $name): string
    {
        $name = $this->escape($name);

        return implode("\n", [
            "✨ <b>Welcome back, {$name}!</b>",
            '',
            $this->divider(),
            '🛍️ Shop the latest collection',
            '📦 Track your orders instantly',
            '🎁 Receive exclusive member offers',
            $this->divider(),
            '',
            'Choose an option below or use the menu keyboard.',
        ]);
    }

    public function welcomeGuest(string $firstName): string
    {
        $firstName = $this->escape($firstName);

        return implode("\n", [
            "✨ <b>Welcome to ".self::BRAND.", {$firstName}!</b>",
            '',
            $this->divider(),
            'Link your store account to unlock:',
            '• Order history & live tracking',
            '• Loyalty updates & promotions',
            '• Seamless shopping in Telegram',
            $this->divider(),
            '',
            'Tap <b>🔗 Link Account</b> below, or sign in via the store Mini App.',
        ]);
    }

    public function profileCard(
        string $name,
        string $email,
        ?string $phone,
        ?string $telegramHandle,
        int $orderCount,
        string $status
    ): string {
        $phoneLine = $phone ? $this->escape($phone) : '—';
        $handleLine = $telegramHandle ? $this->escape($telegramHandle) : '—';

        return implode("\n", [
            '👤 <b>Your member profile</b>',
            '',
            $this->divider(),
            '👋 '.$this->escape($name),
            '📧 '.$this->escape($email),
            '📱 '.$phoneLine,
            '💬 '.$handleLine,
            '',
            '📦 Orders: <b>'.$orderCount.'</b>',
            '🔐 Status: <b>'.ucfirst($this->escape($status)).'</b>',
            $this->divider(),
            '',
            '✅ Telegram linked',
        ]);
    }

    public function helpText(string $storeUrl, bool $miniAppAvailable): string
    {
        $lines = [
            '❓ <b>'.self::BRAND.' Assistant</b>',
            '',
            $this->divider(),
            '<b>Commands</b>',
            '/start — Home',
            '/link — Connect your account',
            '/profile — Member profile',
            '/orders — Order history',
            '/products — Featured picks',
            '/search — Find products',
            '/menu — Refresh menu',
            '/help — This guide',
            '',
            '<b>Link your account</b>',
            '• Share your contact via 🔗 Link Account',
            '• Or sign in inside the Telegram store',
            $this->divider(),
        ];

        if ($storeUrl !== '') {
            $safeUrl = htmlspecialchars($storeUrl, ENT_QUOTES, 'UTF-8');
            $lines[] = '🌐 <a href="'.$safeUrl.'">Open online store</a>';
        }

        if ($miniAppAvailable) {
            $lines[] = '🛍️ Use <b>Shop Now</b> beside the chat box for in-app shopping.';
        }

        return implode("\n", $lines);
    }

    public function productsCatalog(array $items, string $storeUrl): string
    {
        $lines = [
            '🛍️ <b>Featured for you</b>',
            '',
            $this->divider(),
        ];

        foreach ($items as $index => $item) {
            $num = $index + 1;
            $lines[] = "<b>{$num}.</b> ".$this->escape($item['name']);
            $lines[] = '   💵 $'.number_format((float) $item['price'], 2);
        }

        $lines[] = $this->divider();

        if ($storeUrl !== '') {
            $lines[] = '';
            $lines[] = 'Tap a product button below or browse the full catalog.';
        }

        return implode("\n", $lines);
    }

    public function ordersSummary(int $count, array $orderLines): string
    {
        $header = $count === 0
            ? '📦 <b>Your orders</b>'
            : '📦 <b>Your recent orders</b> ('.$count.')';

        return implode("\n", array_merge(
            [$header, '', $this->divider()],
            $orderLines,
            [$this->divider()]
        ));
    }

    public function orderLine(string $orderNumber, string $date, string $total, string $statusBadge): string
    {
        return implode("\n", [
            '',
            '🧾 <b>#'.$this->escape($orderNumber).'</b>',
            '📅 '.$this->escape($date),
            '💵 $'.$total,
            $statusBadge,
        ]);
    }

    public function emptyOrders(): string
    {
        return implode("\n", [
            '📦 <b>Your orders</b>',
            '',
            $this->divider(),
            'You have no orders yet.',
            '',
            'Start shopping — we will notify you here when you place an order.',
            $this->divider(),
        ]);
    }

    public function linkSuccess(): string
    {
        return implode("\n", [
            '✅ <b>Account linked successfully!</b>',
            '',
            $this->divider(),
            'You will receive order updates and member promotions in this chat.',
            $this->divider(),
            '',
            'Explore the menu below to shop or view your profile.',
        ]);
    }
}
