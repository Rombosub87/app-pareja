/* ── Wheel ─────────────────────────────────────────────────────────────────
   Solo se ejecuta en el dashboard (/dashboard)
   ─────────────────────────────────────────────────────────────────────────── */

(function () {
    "use strict";

    // ── Config ──────────────────────────────────────────────────────────────
    const STATUSES = [
        { label: "Pienso en ti",              emoji: "💭", color: "#60a5fa" },
        { label: "Necesito llamarte",          emoji: "📞", color: "#3b82f6" },
        { label: "Tengo que contarte algo",    emoji: "🤫", color: "#2563eb" },
        { label: "Estoy sobrepensando",        emoji: "🌀", color: "#1d4ed8" },
        { label: "Me apetece tener una cita",  emoji: "✨", color: "#0052ff" },
    ];

    const SEGMENT_EMOJIS = {
        "Pienso en ti":              "💭",
        "Necesito llamarte":         "📞",
        "Tengo que contarte algo":   "🤫",
        "Estoy sobrepensando":       "🌀",
        "Me apetece tener una cita": "✨",
        "Sin estado todavía":        "💤",
        "":                          "💤",
    };

    // ── Helpers SVG ─────────────────────────────────────────────────────────
    const SVG_NS = "http://www.w3.org/2000/svg";

    function polarToXY(angleDeg, r) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return [Math.cos(rad) * r, Math.sin(rad) * r];
    }

    function makeSegmentPath(startAngle, endAngle, r = 0.92, innerR = 0.32) {
        const [x1, y1] = polarToXY(startAngle, r);
        const [x2, y2] = polarToXY(endAngle, r);
        const [ix1, iy1] = polarToXY(startAngle, innerR);
        const [ix2, iy2] = polarToXY(endAngle, innerR);
        const large = endAngle - startAngle > 180 ? 1 : 0;
        return [
            `M ${ix1} ${iy1}`,
            `L ${x1} ${y1}`,
            `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
            `L ${ix2} ${iy2}`,
            `A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}`,
            "Z",
        ].join(" ");
    }

    function makeLabelPosition(startAngle, endAngle, r = 0.62) {
        const mid = (startAngle + endAngle) / 2;
        return polarToXY(mid, r);
    }

    // ── Rueda ────────────────────────────────────────────────────────────────
    function buildWheel() {
        const wrapper = document.getElementById("myWheel");
        if (!wrapper) return;

        const svg = wrapper.querySelector(".wheel-svg");
        const n   = STATUSES.length;
        const step = 360 / n;

        STATUSES.forEach((s, i) => {
            const start = i * step;
            const end   = start + step;

            // Path
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", makeSegmentPath(start, end));
            path.setAttribute("fill", s.color);
            path.setAttribute("stroke", "#e0f2fe");
            path.setAttribute("stroke-width", "0.025");
            path.classList.add("wheel-segment");
            path.setAttribute("role", "button");
            path.setAttribute("tabindex", "0");
            path.setAttribute("aria-label", s.label);
            path.dataset.status = s.label;

            // Emoji label
            const [lx, ly] = makeLabelPosition(start, end);
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("x", lx);
            text.setAttribute("y", ly);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("font-size", "0.16");
            text.setAttribute("pointer-events", "none");
            text.textContent = s.emoji;

            svg.appendChild(path);
            svg.appendChild(text);

            // Events
            path.addEventListener("click", () => selectStatus(s.label));
            path.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") selectStatus(s.label);
            });
        });

        // Highlight current if exists
        if (typeof MY_CURRENT_STATUS !== "undefined" && MY_CURRENT_STATUS) {
            highlightSegment(MY_CURRENT_STATUS, svg);
        }
    }

    function highlightSegment(statusLabel, svg) {
    svg = svg || document.querySelector(".wheel-svg");
    if (!svg) return;

    // Recorremos los quesitos sin alterar la estructura del SVG
    svg.querySelectorAll(".wheel-segment").forEach((p) => {
        const isSelected = p.dataset.status === statusLabel;

        // Cambiamos solo el color de relleno y la opacidad
        if (isSelected) {
            p.style.fill = "#0052ff";        /* Azul eléctrico e intenso */
            p.style.opacity = "1";
            p.style.stroke = "#0052ff";
        } else {
            p.style.fill = "";               /* Vuelve a su color base en la lista */
            p.style.opacity = "0.45";        /* Suaviza los no seleccionados */
            p.style.stroke = "#e0f2fe";
        }
    });

    const icon = document.getElementById("centerIcon");
    if (icon) icon.textContent = SEGMENT_EMOJIS[statusLabel] || "💙";
}

    // ── Actualizar estado ────────────────────────────────────────────────────
    async function selectStatus(label) {
        const labelEl = document.getElementById("myStatusLabel");
        if (labelEl) { labelEl.style.opacity = ".4"; }

        try {
            const res  = await fetch("/update_status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: label }),
            });
            const data = await res.json();

            if (data.ok) {
                if (labelEl) {
                    labelEl.textContent = label;
                    labelEl.style.opacity = "1";
                }
                highlightSegment(label);
                showToast("Estado actualizado 💙");
            } else {
                showToast("Error al guardar 😕");
                if (labelEl) labelEl.style.opacity = "1";
            }
        } catch {
            showToast("Sin conexión 😕");
            if (labelEl) labelEl.style.opacity = "1";
        }
    }

    // ── Panel de la pareja ───────────────────────────────────────────────────
    let lastPartnerStatus = null;

    async function pollPartner() {
        try {
            const res  = await fetch("/partner_status");
            const data = await res.json();
            if (!data.ok) return;

            const status   = data.status || "";
            const statusEl = document.getElementById("partnerStatus");
            const iconEl   = document.getElementById("partnerIcon");
            const pulseEl  = document.getElementById("partnerPulse");
            const cardEl   = document.getElementById("partnerCard");

            if (status !== lastPartnerStatus) {
                lastPartnerStatus = status;

                if (statusEl) statusEl.textContent = status || "Sin estado todavía";
                if (iconEl)   iconEl.textContent   = SEGMENT_EMOJIS[status] || "💤";

                if (pulseEl) {
                    pulseEl.classList.toggle("active", !!status);
                }
                if (cardEl && status) {
                    cardEl.classList.remove("bump");
                    void cardEl.offsetWidth; // reflow
                    cardEl.classList.add("bump");
                }
            }
        } catch {
            /* silencioso si no hay red */
        }
    }

    // ── Toast ────────────────────────────────────────────────────────────────
    let toastTimeout;
    function showToast(msg) {
        let toast = document.getElementById("appToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "appToast";
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        clearTimeout(toastTimeout);
        toast.textContent = msg;
        toast.classList.add("show");
        toastTimeout = setTimeout(() => toast.classList.remove("show"), 2200);
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    document.addEventListener("DOMContentLoaded", () => {
        buildWheel();

        // Solo pollean si estamos en el dashboard
        if (document.getElementById("partnerCard")) {
            pollPartner();
            setInterval(pollPartner, 8000); // cada 8 s
        }
    });
})();
