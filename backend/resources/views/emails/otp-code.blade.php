<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>{{ $appName }} verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fb;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:24px 12px;background-color:#f3f6fb;">
	<tr>
		<td align="center" style="padding:0;">
			<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #dbe4f0;border-radius:12px;">
				@if(!empty($logoUrl))
				<tr>
					<td align="center" style="padding:20px;">
						<img src="{{ $logoUrl }}" alt="{{ $appName }}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:10px;" />
					</td>
				</tr>
				@else
				<tr>
					<td style="padding:28px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;color:#38554a;text-align:center;">
						<div style="font-size:22px;line-height:28px;font-weight:700;letter-spacing:0.5px;">{{ $appName }}</div>
					</td>
				</tr>
				@endif
				<tr>
					<td style="padding:8px 24px 6px 24px;font-family:Arial,Helvetica,sans-serif;color:#10233f;text-align:center;">
						<div style="font-size:20px;line-height:28px;font-weight:700;">Your verification code</div>
					</td>
				</tr>
				<tr>
					<td style="padding:0 24px 20px 24px;font-family:Arial,Helvetica,sans-serif;color:#52637a;text-align:center;">
						<div style="font-size:16px;line-height:24px;">Enter this code to {{ $purposeAction }}.</div>
					</td>
				</tr>
				<tr>
					<td align="center" style="padding:0 24px 20px 24px;">
						<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f8f6;border:1px solid #c8d9d2;border-radius:10px;">
							<tr>
								<td align="center" style="padding:18px 28px;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:6px;color:#1f2a44;">
									{{ $code }}
								</td>
							</tr>
						</table>
					</td>
				</tr>
				<tr>
					<td style="padding:0 24px 28px 24px;font-family:Arial,Helvetica,sans-serif;color:#6a778c;text-align:center;">
						<div style="font-size:14px;line-height:21px;">
							This code expires in {{ $expiresMinutes }} minutes.<br>
							If you did not request this, you can safely ignore this email.
						</div>
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>
</body>
</html>
