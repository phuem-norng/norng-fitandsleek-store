import React, { useState } from "react";
import { ReportSection } from "./ReportChartUI.jsx";
import {
  REPORT_FORMULA_COMMON,
  REPORT_FORMULA_NOTE_EN,
  REPORT_FORMULA_NOTE_KH,
  REPORT_FORMULA_SECTIONS,
} from "../../lib/reportFormulasContent.js";

function FormulaBlock({ item, theme }) {
  return (
    <article
      className="rounded-xl border px-4 py-3.5"
      style={{ borderColor: theme.cardBorder, background: theme.panelBg }}
    >
      <h4 className="text-sm font-semibold" style={{ color: theme.title }}>
        {item.visualEn}
        <span className="mx-1.5 font-normal opacity-40">·</span>
        <span className="font-medium" style={{ color: theme.subtitle }}>
          {item.visualKh}
        </span>
      </h4>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">
        <p style={{ color: theme.subtitle }}>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: theme.title }}>
            EN
          </span>
          <span className="ml-2 font-mono text-[13px]" style={{ color: theme.title }}>
            {item.formulaEn}
          </span>
        </p>
        <p style={{ color: theme.subtitle }}>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: theme.title }}>
            KH
          </span>
          <span className="ml-2" style={{ color: theme.title }}>
            {item.formulaKh}
          </span>
        </p>
      </div>
    </article>
  );
}

function SectionAccordion({ section, theme, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: theme.cardBorder, background: theme.isDark ? "rgba(15,23,42,0.35)" : "#f8fafc" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:opacity-90"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold" style={{ color: theme.title }}>
            {section.titleEn}
          </span>
          <span className="mt-0.5 block text-xs" style={{ color: theme.subtitle }}>
            {section.titleKh}
          </span>
        </span>
        <svg
          className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: theme.subtitle }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className="space-y-3 border-t px-4 pb-4 pt-3" style={{ borderColor: theme.cardBorder }}>
          {section.items.map((item) => (
            <FormulaBlock key={`${section.id}-${item.visualEn}`} item={item} theme={theme} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReportFormulasSection({ theme }) {
  return (
    <ReportSection
      id="report-formulas"
      title="Formulas"
      subtitle="រូបមន្ត · Calculation reference for every visual"
      theme={theme}
      className="scroll-mt-24"
    >
      <div
        className="mb-6 rounded-2xl border px-4 py-4 sm:px-5"
        style={{
          borderColor: theme.cardBorder,
          background: theme.isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.06)",
        }}
      >
        <p className="text-sm font-medium leading-relaxed" style={{ color: theme.title }}>
          {REPORT_FORMULA_NOTE_KH}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.subtitle }}>
          {REPORT_FORMULA_NOTE_EN}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.subtitle }}>
          Shared rules · ច្បាប់រួម
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_FORMULA_COMMON.map((row) => (
            <div
              key={row.labelEn}
              className="rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: theme.cardBorder, background: theme.panelBg }}
            >
              <p className="font-semibold" style={{ color: theme.title }}>
                {row.labelEn}
                <span className="font-normal text-xs opacity-70"> · {row.labelKh}</span>
              </p>
              <p className="mt-1.5 font-mono text-[12px] leading-snug" style={{ color: theme.subtitle }}>
                {row.formulaEn}
              </p>
              <p className="mt-1 text-[12px] leading-snug" style={{ color: theme.title }}>
                {row.formulaKh}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {REPORT_FORMULA_SECTIONS.map((section, index) => (
          <SectionAccordion key={section.id} section={section} theme={theme} defaultOpen={index < 2} />
        ))}
      </div>
    </ReportSection>
  );
}
