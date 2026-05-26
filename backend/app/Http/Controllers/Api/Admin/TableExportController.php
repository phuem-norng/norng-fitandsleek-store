<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\AdminSpreadsheetExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TableExportController extends Controller
{
    public function export(Request $request)
    {
        $validated = $request->validate([
            'format' => ['required', 'in:pdf,excel'],
            'filename' => ['required', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:200'],
            'subtitle' => ['nullable', 'string', 'max:300'],
            'headers' => ['required', 'array', 'max:40'],
            'headers.*' => ['string', 'max:200'],
            'rows' => ['required', 'array', 'max:5000'],
            'rows.*' => ['array', 'max:40'],
        ]);

        $headers = array_values($validated['headers']);
        $rows = array_map(
            fn (array $row) => array_map(fn ($cell) => (string) ($cell ?? ''), $row),
            $validated['rows'],
        );

        $filename = preg_replace('/[^A-Za-z0-9._-]+/', '-', $validated['filename']) ?: 'export';

        try {
            if ($validated['format'] === 'excel') {
                return AdminSpreadsheetExport::download(
                    $headers,
                    $rows,
                    str_ends_with(strtolower($filename), '.xls') || str_ends_with(strtolower($filename), '.xlsx')
                        ? $filename
                        : $filename.'.xls',
                );
            }

            $pdf = Pdf::setOptions([
                // Required for the brand banner image (hosted on Cloudflare R2) to render.
                'isRemoteEnabled' => true,
                'isHtml5ParserEnabled' => true,
                'defaultFont' => 'DejaVu Sans',
            ])->loadView('exports.table', [
                'title' => $validated['title'],
                'subtitle' => $validated['subtitle'] ?? null,
                'headers' => $headers,
                'rows' => $rows,
            ])->setPaper('A4', 'landscape');

            $pdfName = str_ends_with(strtolower($filename), '.pdf') ? $filename : $filename.'.pdf';

            return response($pdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$pdfName.'"',
            ]);
        } catch (\Throwable $e) {
            Log::error('Admin table export failed', [
                'format' => $validated['format'],
                'title' => $validated['title'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to generate export. Please try again.',
            ], 500);
        }
    }
}
