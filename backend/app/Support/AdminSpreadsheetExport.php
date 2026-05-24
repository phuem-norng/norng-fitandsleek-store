<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\Response;

class AdminSpreadsheetExport
{
    /**
     * @param  list<string>  $headers
     * @param  list<list<string|int|float|null>>  $rows
     */
    public static function download(array $headers, array $rows, string $filename): Response
    {
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $filename) ?: 'export.xls';
        if (! str_ends_with(strtolower($safeName), '.xls') && ! str_ends_with(strtolower($safeName), '.xlsx')) {
            $safeName .= '.xls';
        }

        $html = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
        foreach ($headers as $header) {
            $html .= '<th>'.htmlspecialchars((string) $header, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</th>';
        }
        $html .= '</tr></thead><tbody>';

        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach ($row as $cell) {
                $html .= '<td>'.htmlspecialchars((string) ($cell ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table></body></html>';

        return response($html, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$safeName.'"',
        ]);
    }
}
