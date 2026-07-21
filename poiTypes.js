/**
 * Single source of truth for social-map POI types, labels, and SVG icons.
 * Used by markers, legend, toolbar, and the POI type select.
 */

export const LINE_TYPES = new Set(['road', 'curved_road', 'canal']);

export const POI_TYPES = [
    {
        id: 'house',
        label: 'Makan (House)',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2L2 22h20L12 2z" fill="none" stroke="#ef4444" stroke-width="2"/></svg>'
    },
    {
        id: 'empty_house',
        label: 'Khali Makan',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 22L2 2h20L12 22z" fill="none" stroke="#ef4444" stroke-width="2"/></svg>'
    },
    {
        id: 'house_solid',
        label: 'Makan (Solid)',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2L2 22h20L12 2z" fill="#ef4444"/></svg>'
    },
    {
        id: 'empty_house_solid',
        label: 'Khali Makan (Solid)',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 22L2 2h20L12 22z" fill="#ef4444"/></svg>'
    },
    {
        id: 'service_provider',
        label: 'Seva Pradata',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="#eab308"/></svg>'
    },
    {
        id: 'temple_mosque',
        label: 'Mandir/Masjid',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="white" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'school',
        label: 'Vidyalaya',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="6" width="20" height="12" fill="#8B4513"/></svg>'
    },
    {
        id: 'govt_building',
        label: 'Shaskiya Bhavan',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="6" width="20" height="12" fill="#d946ef"/></svg>'
    },
    {
        id: 'health_center',
        label: 'Up Swasthya Kendra',
        group: 'buildings',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="4" width="20" height="16" fill="white" stroke="black" stroke-width="1"/><path d="M12 7v10M7 12h10" stroke="#22c55e" stroke-width="4"/></svg>'
    },
    {
        id: 'tree',
        label: 'Ped (Tree)',
        group: 'nature',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="9" r="7" fill="#22c55e"/><path d="M12 16v6" stroke="#8B4513" stroke-width="3"/></svg>'
    },
    {
        id: 'pond',
        label: 'Talab (Pond)',
        group: 'nature',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="#3b82f6" stroke-width="2"/><line x1="5" y1="8" x2="19" y2="8" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/><line x1="3" y1="12" x2="21" y2="12" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/><line x1="5" y1="16" x2="19" y2="16" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2 2"/></svg>'
    },
    {
        id: 'handpump_working',
        label: 'Chalu Handpump',
        group: 'water',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 4h8v16H8z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10l5-3" stroke="black" stroke-width="2"/><path d="M6 14h2v6H6z" fill="#3b82f6"/></svg>'
    },
    {
        id: 'handpump_broken',
        label: 'Kharab Handpump',
        group: 'water',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 4h8v16H8z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10l5-3" stroke="black" stroke-width="2"/><path d="M4 14l6 6M10 14l-6 6" stroke="#ef4444" stroke-width="2"/></svg>'
    },
    {
        id: 'tap_working',
        label: 'Chalu Nal',
        group: 'water',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 10h12v4H4z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10v4h4" fill="none" stroke="black" stroke-width="2"/><circle cx="12" cy="18" r="3" fill="#3b82f6"/></svg>'
    },
    {
        id: 'tap_broken',
        label: 'Kharab Nal',
        group: 'water',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 10h12v4H4z" fill="none" stroke="black" stroke-width="2"/><path d="M16 10v4h4" fill="none" stroke="black" stroke-width="2"/><path d="M9 16l6 6M15 16l-6 6" stroke="#ef4444" stroke-width="2"/></svg>'
    },
    {
        id: 'open_defecation',
        label: 'Khule mein Shauch',
        group: 'water',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7" fill="none" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'road',
        label: 'Sadak',
        group: 'network',
        line: true,
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="2" y1="10" x2="22" y2="10" stroke="black" stroke-width="2"/><line x1="2" y1="14" x2="22" y2="14" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'curved_road',
        label: 'Ghumavdar Sadak',
        group: 'network',
        line: true,
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M2 10 Q12 0 22 10" fill="none" stroke="black" stroke-width="2"/><path d="M2 14 Q12 4 22 14" fill="none" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'canal',
        label: 'Nahar (Canal)',
        group: 'network',
        line: true,
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><line x1="2" y1="10" x2="22" y2="10" stroke="#0ea5e9" stroke-width="2"/><line x1="2" y1="14" x2="22" y2="14" stroke="#0ea5e9" stroke-width="2"/></svg>'
    },
    {
        id: 'water_tank',
        label: 'Pani ki Tanki',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6 Q12 2 18 6 v12 Q12 22 6 18 Z" fill="#3b82f6"/></svg>'
    },
    {
        id: 'underground_tank',
        label: 'Bhumigat Tank',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="6" width="18" height="12" fill="none" stroke="black" stroke-width="2"/><line x1="3" y1="18" x2="21" y2="6" stroke="black" stroke-width="2"/><line x1="3" y1="12" x2="12" y2="6" stroke="black" stroke-width="2"/><line x1="12" y1="18" x2="21" y2="12" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'transformer',
        label: 'Transformer',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="none" stroke="black" stroke-width="2"/><line x1="4" y1="4" x2="20" y2="20" stroke="black" stroke-width="2"/><line x1="20" y1="4" x2="4" y2="20" stroke="black" stroke-width="2"/></svg>'
    },
    {
        id: 'solar_panel',
        label: 'Saur Plate (Solar)',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="6" width="18" height="12" fill="none" stroke="black" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke="black" stroke-width="1"/><line x1="9" y1="6" x2="9" y2="18" stroke="black" stroke-width="1"/><line x1="15" y1="6" x2="15" y2="18" stroke="black" stroke-width="1"/></svg>'
    },
    {
        id: 'power_center',
        label: 'Bijli Kendra',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="black" stroke-width="2"/><line x1="6" y1="6" x2="6" y2="18" stroke="black" stroke-width="1"/><line x1="10" y1="6" x2="10" y2="18" stroke="black" stroke-width="1"/><line x1="14" y1="6" x2="14" y2="18" stroke="black" stroke-width="1"/><line x1="18" y1="6" x2="18" y2="18" stroke="black" stroke-width="1"/></svg>'
    },
    {
        id: 'playground',
        label: 'Khel Maidan',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"/></svg>'
    },
    {
        id: 'well',
        label: 'Kuan/Tube Well',
        group: 'infra',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2" stroke-dasharray="2 2"/></svg>'
    },
    {
        id: 'misc',
        label: 'Miscellaneous / Other',
        group: 'misc',
        svg: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="9" fill="#f43f5e"/><text x="12" y="16" font-size="12" font-family="sans-serif" text-anchor="middle" fill="white" font-weight="bold">?</text></svg>'
    }
];

const byId = Object.fromEntries(POI_TYPES.map((t) => [t.id, t]));

const LEGACY_TYPE_MAP = {
    shop: 'service_provider',
    temple: 'temple_mosque',
    church: 'temple_mosque',
    landmark: 'govt_building',
    poi: 'house_solid'
};

/** Escape user-controlled strings before inserting into HTML. */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Normalize legacy type ids to current catalog ids. */
export function resolvePoiType(type) {
    const raw = type || 'house_solid';
    return LEGACY_TYPE_MAP[raw] || raw;
}

export function getPoiDef(type) {
    return byId[resolvePoiType(type)] || byId.misc;
}

export function getPoiSvg(type) {
    return getPoiDef(type).svg;
}

export function getPoiLabel(type) {
    return getPoiDef(type).label;
}

/** Accent color for marker chrome (from stroke/fill of icon SVG). */
export function extractIconColor(svgHtml) {
    const strokeMatch = svgHtml.match(/stroke="([^"]+)"/);
    const fillMatch = svgHtml.match(/fill="([^"]+)"/);

    if (strokeMatch && strokeMatch[1] !== 'none' && strokeMatch[1] !== 'white' && strokeMatch[1] !== 'black') {
        return strokeMatch[1];
    }
    if (fillMatch && fillMatch[1] !== 'none' && fillMatch[1] !== 'white' && fillMatch[1] !== 'black') {
        return fillMatch[1];
    }
    if (strokeMatch && strokeMatch[1] === 'black') return '#000';
    if (fillMatch && fillMatch[1] === 'black') return '#000';
    return '#f43f5e';
}

/** Render legend list items into a container element. */
export function renderLegend(container) {
    if (!container) return;
    container.innerHTML = POI_TYPES.map(
        (t) =>
            `<div class="legend-item"><span class="legend-icon-badge">${t.svg}</span><span class="legend-text">${escapeHtml(t.label)}</span></div>`
    ).join('');
}

/**
 * Render edit toolbar buttons. Groups get a divider before the first item
 * of water, network, infra (after buildings/nature block).
 */
export function renderToolbar(container) {
    if (!container) return;
    const dividersBefore = new Set(['handpump_working', 'road', 'water_tank', 'misc']);
    const parts = [];

    for (const t of POI_TYPES) {
        if (dividersBefore.has(t.id) && parts.length > 0) {
            parts.push('<div class="tool-divider" style="width:100%; height:1px; background:#ccc; margin:4px 0;"></div>');
        }
        parts.push(
            `<button class="btn-tool" data-type="${escapeHtml(t.id)}" title="${escapeHtml(t.label)}">${t.svg}</button>`
        );
    }

    parts.push('<div class="tool-divider" style="width:100%; height:1px; background:#ccc; margin:4px 0;"></div>');
    parts.push(
        '<button class="btn-tool danger" data-type="delete" title="Delete Mode"><i data-lucide="trash-2"></i></button>'
    );
    container.innerHTML = parts.join('');
}

/** Populate a <select> with POI type options. */
export function populateTypeSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    for (const t of POI_TYPES) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.label;
        selectEl.appendChild(opt);
    }
}
