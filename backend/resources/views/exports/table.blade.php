<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #111827; font-size: 11px; }
        h1 { font-size: 16px; margin: 0 0 8px 0; }
        .muted { color: #6b7280; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e5e7eb; padding: 5px 7px; text-align: left; }
        th { background: #f3f4f6; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    @if (!empty($subtitle))
        <div class="muted">{{ $subtitle }}</div>
    @endif

    <table>
        <thead>
            <tr>
                @foreach ($headers as $header)
                    <th>{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>{{ $cell }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ max(count($headers), 1) }}">No data</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
