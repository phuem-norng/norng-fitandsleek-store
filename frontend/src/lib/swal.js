import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const DANGER = "#dc2626";
const FALLBACK_PRIMARY = "#6B7E73";

function cssVarHex(name, fallback) {
    if (typeof document === "undefined") return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw || !raw.startsWith("#")) return fallback;
    return raw;
}

function isDarkChrome() {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** English-first; Khmer legacy keys used only when English is absent. */
function englishTitle(parts) {
    return parts.title || parts.enTitle || parts.khTitle || "";
}

function englishBody(parts) {
    const { enText, khText } = parts;
    if (enText != null && String(enText).length) return String(enText);
    if (khText != null && String(khText).length) return String(khText);
    return undefined;
}

function englishButton(en, kh) {
    return en || kh || "";
}

const modalChromeColors = () => {
    const dark = isDarkChrome();
    return {
        background: dark ? "#0f172a" : "#ffffff",
        color: dark ? "#f1f5f9" : "#0f172a",
    };
};

/** Shared modal layout — custom button colours via didRender when buttonsStyling is false */
const modalLayoutClasses = () => ({
    buttonsStyling: false,
    customClass: {
        popup:
            "!rounded-[1.125rem] !px-10 !pb-9 !pt-12 !shadow-2xl !border dark:!border-slate-700/80 !border-slate-200/90",
        title: "!text-lg !font-semibold !tracking-tight !text-slate-900 dark:!text-slate-50 !px-0 !pb-1 !mt-1",
        htmlContainer: "!text-sm !text-slate-600 dark:!text-slate-400 !mt-3 !leading-relaxed !px-0",
        confirmButton:
            "!m-0 !rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none focus:!ring-2 focus:!ring-offset-2 dark:focus:!ring-offset-[#0f172a]",
        cancelButton:
            "!m-0 !rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none !border !border-slate-300 dark:!border-slate-600 !bg-transparent !text-slate-700 dark:!text-slate-200 hover:!bg-slate-100 dark:hover:!bg-slate-800 focus:!ring-2 focus:!ring-offset-2 dark:focus:!ring-offset-[#0f172a]",
        actions: "!mt-10 !gap-3 !justify-end flex-wrap",
        icon: "!mt-2",
    },
});

const toastClasses = () => ({
    toast: true,
    position: "top-end",
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
    buttonsStyling: false,
    customClass: {
        toast:
            "!rounded-xl !shadow-lg dark:!shadow-black/40 !border !border-slate-200/80 dark:!border-slate-700/70",
        title:
            "!text-sm !font-semibold !tracking-tight !text-slate-900 dark:!text-slate-50 !leading-snug !px-0 !m-0 !mt-3",
        htmlContainer:
            "!text-[13px] !text-slate-600 dark:!text-slate-400 !leading-snug !px-0 !mx-6 !my-5 !font-normal !block",
        container: "!p-2",
        timerProgressBar: "!bg-[color:var(--admin-primary)]",
    },
});

/**
 * @deprecated use English-only `enTitle` / `enText`
 */
export const biText = (kh, en) => `${kh} (${en})`;

/** @param {string | object} arg */
export const toastSuccess = async (arg) => {
    const opts = typeof arg === "string" ? { enText: arg } : arg || {};
    const dark = isDarkChrome();
    const head = englishTitle(opts) || "Success";
    const text = englishBody(opts);

    const col = modalChromeColors();
    return Swal.fire({
        ...toastClasses(),
        icon: "success",
        iconColor: cssVarHex("--admin-primary", FALLBACK_PRIMARY),
        title: head,
        ...(text ? { text } : {}),
        ...col,
    });
};

export const errorAlert = async ({
    title,
    khTitle,
    enTitle,
    khText,
    enText,
    detail,
} = {}) => {
    const head =
        englishTitle({ title, enTitle: enTitle ?? undefined, khTitle }) || "Something went wrong";
    const msg = englishBody({ enText, khText }) || "Please try again.";
    const text = detail ? `${msg}\n\n${detail}` : msg;
    const dark = isDarkChrome();

    return Swal.fire({
        ...modalLayoutClasses(),
        ...modalChromeColors(),
        icon: "error",
        iconColor: DANGER,
        title: head,
        text,
        confirmButtonText: "OK",
        showCancelButton: false,
        focusConfirm: true,
        didRender: () => {
            const b = Swal.getConfirmButton();
            if (b) {
                b.style.backgroundColor = dark ? "#334155" : "#475569";
                b.style.color = "#ffffff";
                b.style.border = "none";
            }
        },
    });
};

export const warningConfirm = async ({
    title,
    khTitle,
    enTitle,
    khText,
    enText,
    khConfirm,
    enConfirm,
    khCancel,
    enCancel,
    intent = "primary",
    icon,
} = {}) => {
    const head =
        englishTitle({ title, enTitle: enTitle ?? undefined, khTitle }) || "Please confirm";
    const body = englishBody({ enText, khText });
    const destructive = intent === "destructive";
    const confirmLbl =
        englishButton(enConfirm, khConfirm) || (destructive ? "Delete" : "Confirm");
    const cancelResolved = englishButton(enCancel, khCancel) || "Cancel";

    const primaryHex = cssVarHex("--admin-primary", FALLBACK_PRIMARY);
    const dark = isDarkChrome();
    let resolvedIcon = icon || (destructive ? "warning" : "question");

    const iconHue = destructive ? "#f59e0b" : cssVarHex("--admin-primary", FALLBACK_PRIMARY);

    return Swal.fire({
        ...modalLayoutClasses(),
        ...modalChromeColors(),
        icon: resolvedIcon,
        iconColor: iconHue,
        title: head,
        ...(body ? { text: body } : {}),
        showCancelButton: true,
        reverseButtons: true,
        focusCancel: destructive,
        confirmButtonText: confirmLbl,
        cancelButtonText: cancelResolved,
        didRender: () => {
            const ok = Swal.getConfirmButton();
            const cancelBtn = Swal.getCancelButton();
            if (!ok) return;

            ok.style.whiteSpace = "nowrap";
            if (destructive) {
                ok.style.backgroundColor = DANGER;
                ok.style.color = "#ffffff";
                ok.style.border = "none";
            } else {
                ok.style.backgroundColor = primaryHex;
                ok.style.color = dark ? "#0b1119" : "#ffffff";
                ok.style.border = "none";
            }
            if (cancelBtn) cancelBtn.style.minWidth = "5.75rem";
        },
    });
};

export const loadingAlert = ({ title, khTitle, enTitle: ent, khText, enText: ext } = {}) => {
    const head =
        englishTitle({ title, enTitle: ent ?? undefined, khTitle }) || "Processing";
    const body = englishBody({ enText: ext, khText }) || "Please wait.";

    Swal.fire({
        ...modalLayoutClasses(),
        ...modalChromeColors(),
        title: head,
        text: body,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
    });
};

/** Text prompt — English chrome (e.g. rejection reason). */
export const promptEnglish = async ({
    title,
    input = "text",
    inputPlaceholder = "",
    confirmText = "Submit",
    cancelText = "Cancel",
} = {}) => {
    const dark = isDarkChrome();
    const primaryHex = cssVarHex("--admin-primary", FALLBACK_PRIMARY);

    return Swal.fire({
        ...modalLayoutClasses(),
        ...modalChromeColors(),
        title: title || "Enter details",
        input,
        inputPlaceholder,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        didRender: () => {
            const ok = Swal.getConfirmButton();
            if (!ok) return;
            ok.style.backgroundColor = primaryHex;
            ok.style.color = dark ? "#0b1119" : "#ffffff";
            ok.style.border = "none";
        },
    });
};

export const closeSwal = () => Swal.close();

export default Swal;
