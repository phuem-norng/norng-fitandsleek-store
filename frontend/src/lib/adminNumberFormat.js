export const ADMIN_NUMBER_FORMAT = {
  FULL: "full",
  COMPACT: "compact",
};

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(value, numberFormat = ADMIN_NUMBER_FORMAT.COMPACT) {
  const numeric = Number(value) || 0;
  if (numberFormat === ADMIN_NUMBER_FORMAT.FULL) {
    return fullUsd.format(numeric);
  }
  return compactUsd.format(numeric);
}

export function formatUsdFull(value) {
  return fullUsd.format(Number(value) || 0);
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullNumber = new Intl.NumberFormat("en-US");

export function formatNumber(value, numberFormat = ADMIN_NUMBER_FORMAT.COMPACT) {
  const numeric = Number(value) || 0;
  if (numberFormat === ADMIN_NUMBER_FORMAT.FULL) {
    return fullNumber.format(numeric);
  }
  return compactNumber.format(numeric);
}
