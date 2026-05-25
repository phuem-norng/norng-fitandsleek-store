import React from "react";
import { Building2, Banknote } from "lucide-react";
import { getFooterPaymentMethodsForDisplay } from "../../lib/footerPaymentMethods";

const pill = "inline-flex h-6 items-center justify-center rounded px-1.5 text-[9px] font-semibold leading-none";

function BrandBadge({ method }) {
  if (method.id === "aba_pay") {
    return (
      <span className={`${pill} min-w-[2.75rem] flex-col gap-0 py-0.5 text-white`} style={{ background: "#005866" }} title={method.label}>
        <span className="text-[6px] font-bold">ABA</span>
        <span className="text-[8px] font-black text-sky-300">PAY</span>
      </span>
    );
  }
  if (method.id === "visa") {
    return (
      <span className={`${pill} min-w-[2.25rem] italic text-white`} style={{ background: "#1A1F71" }} title={method.label}>
        VISA
      </span>
    );
  }
  if (method.id === "mastercard") {
    return (
      <span className={`${pill} min-w-[2.25rem] gap-0.5 bg-black`} title={method.label}>
        <span className="h-2.5 w-2.5 rounded-full bg-[#EB001B]" />
        <span className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-[#F79E1B]" />
      </span>
    );
  }
  if (method.id === "unionpay") {
    return (
      <span className={`${pill} min-w-[2.5rem] overflow-hidden p-0`} title={method.label}>
        <span className="h-full w-0.5 bg-[#DE1F26]" />
        <span className="h-full w-0.5 bg-[#003B95]" />
        <span className="flex flex-1 items-center justify-center bg-[#007B4E] px-0.5 text-[6px] text-white">UP</span>
      </span>
    );
  }
  if (method.id === "jcb") {
    return (
      <span className={`${pill} min-w-[1.75rem] overflow-hidden p-0`} title={method.label}>
        <span className="flex flex-1 items-center justify-center bg-[#0B4EA2] text-[7px] text-white">J</span>
        <span className="flex flex-1 items-center justify-center bg-[#DE1F26] text-[7px] text-white">C</span>
        <span className="flex flex-1 items-center justify-center bg-[#007B4E] text-[7px] text-white">B</span>
      </span>
    );
  }
  if (method.id === "khqr") {
    return (
      <span className={`${pill} min-w-[2rem] flex-col gap-0 py-0.5 text-white`} style={{ background: "#C0272D" }} title={method.label}>
        <span className="text-[7px] font-black">KH</span>
        <span className="text-[7px] font-black text-amber-300">QR</span>
      </span>
    );
  }
  if (method.id === "wing") {
    return (
      <span className={`${pill} text-white`} style={{ background: "#7AB800" }} title={method.label}>
        Wing
      </span>
    );
  }
  return (
    <span className={`${pill} border border-white/20 bg-white/10 text-white/90`} title={method.label}>
      {method.label}
    </span>
  );
}

function TextMethod({ method }) {
  const Icon = method.id === "cod" ? Banknote : Building2;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-white/75" title={method.label}>
      <Icon className="h-3 w-3 shrink-0 text-white/60" strokeWidth={1.75} />
      <span>{method.label}</span>
    </span>
  );
}

export default function FooterAcceptedPayments({ methodIds, title = "We Accept" }) {
  const methods = getFooterPaymentMethodsForDisplay(methodIds);
  if (!methods.length) return null;

  const brands = methods.filter((m) => m.type === "brand");
  const others = methods.filter((m) => m.type === "text");

  return (
    <div className="pt-1">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">{title}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {brands.map((method) => (
          <BrandBadge key={method.id} method={method} />
        ))}
        {brands.length > 0 && others.length > 0 ? (
          <span className="hidden h-3 w-px bg-white/25 sm:inline-block" aria-hidden />
        ) : null}
        {others.map((method) => (
          <TextMethod key={method.id} method={method} />
        ))}
      </div>
    </div>
  );
}
