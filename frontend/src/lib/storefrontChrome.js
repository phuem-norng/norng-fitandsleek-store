/** Shared storefront header/footer chrome (background + text + optional image). */
import { resolveImageUrl } from './images.js';

export const DEFAULT_CHROME_BACKGROUND = '#6e8b7e';
export const DEFAULT_CHROME_TEXT = '#ffffff';

function chromeImageLayerStyle(imageUrl, tintColor) {
  if (!imageUrl) return {};
  const safe = String(imageUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const tint = tintColor || DEFAULT_CHROME_BACKGROUND;
  return {
    backgroundImage: `linear-gradient(color-mix(in srgb, ${tint} 70%, transparent), color-mix(in srgb, ${tint} 70%, transparent)), url("${safe}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  };
}

export function buildStorefrontChromeStyle({
  backgroundColor,
  textColor,
  backgroundImage,
} = {}) {
  const bg = backgroundColor || DEFAULT_CHROME_BACKGROUND;
  const text = textColor || DEFAULT_CHROME_TEXT;
  const resolvedImage = backgroundImage ? resolveImageUrl(backgroundImage) : '';

  const style = {
    '--fs-chrome-bg': bg,
    '--fs-chrome-text': text,
    '--fs-chrome-text-muted': `color-mix(in srgb, ${text} 82%, transparent)`,
    '--fs-chrome-border': `color-mix(in srgb, ${text} 22%, transparent)`,
    '--fs-chrome-surface': `color-mix(in srgb, ${text} 14%, ${bg})`,
    backgroundColor: bg,
    color: text,
    ...chromeImageLayerStyle(resolvedImage, bg),
  };

  return style;
}

/** Header chrome — image from header settings only. */
export function resolveHeaderChromeStyle(header = {}, footer = {}) {
  return buildStorefrontChromeStyle({
    backgroundColor: header.background_color || footer.background_color,
    textColor: header.text_color || footer.text_color,
    backgroundImage: header.background_image || '',
  });
}

/** Footer chrome — image from footer settings only. */
export function resolveFooterChromeStyle(footer = {}, header = {}) {
  return buildStorefrontChromeStyle({
    backgroundColor: footer.background_color || header.background_color,
    textColor: footer.text_color || header.text_color,
    backgroundImage: footer.background_image || '',
  });
}

/** @deprecated Use resolveHeaderChromeStyle / resolveFooterChromeStyle */
export function resolveStorefrontChromeStyle(header = {}, footer = {}) {
  return resolveHeaderChromeStyle(header, footer);
}
