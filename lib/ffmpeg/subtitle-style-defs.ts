// Pure style definitions — no Node.js imports, safe to use in client components

export interface SubtitleStyle {
  id: string;
  label: string;
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  primaryColor: string; // ASS &HAABBGGRR
  outlineColor: string;
  shadowColor: string;
  outline: number;
  shadow: number;
  alignment: number; // 2=bottom-center, 8=top-center
  // drawtext parameters (used by executor — no libass required)
  dt: {
    fontsize: number;
    fontcolor: string;
    borderw: number;
    bordercolor: string;
    shadowx: number;
    shadowy: number;
    shadowcolor: string;
    box: number;       // 1=enabled, 0=disabled
    boxcolor: string;
  };
  preview: {
    bg: string;
    text: string;
    textColor: string;
    border: string;
  };
}

export const SUBTITLE_STYLES: SubtitleStyle[] = [
  {
    id: 'capcut',
    label: 'CapCut',
    fontName: 'Arial Black',
    fontSize: 72,
    bold: true,
    italic: false,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    shadowColor: '&H00000000',
    outline: 5,
    shadow: 3,
    alignment: 2,
    dt: { fontsize: 72, fontcolor: 'white', borderw: 5, bordercolor: 'black', shadowx: 3, shadowy: 3, shadowcolor: 'black@0.7', box: 0, boxcolor: 'black@0.0' },
    preview: { bg: 'bg-black', text: 'Aa', textColor: 'text-white font-black', border: 'border-amber-600' },
  },
  {
    id: 'clasico',
    label: 'Clásico',
    fontName: 'Arial',
    fontSize: 48,
    bold: true,
    italic: false,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    shadowColor: '&H00000000',
    outline: 2,
    shadow: 1,
    alignment: 2,
    dt: { fontsize: 52, fontcolor: 'white', borderw: 3, bordercolor: 'black', shadowx: 2, shadowy: 2, shadowcolor: 'black@0.6', box: 0, boxcolor: 'black@0.0' },
    preview: { bg: 'bg-slate-900', text: 'Aa', textColor: 'text-white font-bold', border: 'border-slate-600' },
  },
  {
    id: 'impacto',
    label: 'Impacto',
    fontName: 'Impact',
    fontSize: 66,
    bold: true,
    italic: false,
    primaryColor: '&H0000FFFF',
    outlineColor: '&H00000000',
    shadowColor: '&H00000000',
    outline: 3,
    shadow: 0,
    alignment: 2,
    dt: { fontsize: 68, fontcolor: 'yellow', borderw: 4, bordercolor: 'black', shadowx: 0, shadowy: 0, shadowcolor: 'black@0.0', box: 0, boxcolor: 'black@0.0' },
    preview: { bg: 'bg-black', text: 'Aa', textColor: 'text-yellow-300 font-black', border: 'border-yellow-700' },
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    fontName: 'Arial',
    fontSize: 36,
    bold: false,
    italic: true,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H80000000',
    shadowColor: '&H80000000',
    outline: 1,
    shadow: 2,
    alignment: 2,
    dt: { fontsize: 40, fontcolor: 'white@0.9', borderw: 1, bordercolor: 'black@0.5', shadowx: 2, shadowy: 2, shadowcolor: 'black@0.4', box: 0, boxcolor: 'black@0.0' },
    preview: { bg: 'bg-slate-800', text: 'Aa', textColor: 'text-slate-200 italic', border: 'border-slate-600' },
  },
  {
    id: 'elegante',
    label: 'Elegante',
    fontName: 'Georgia',
    fontSize: 44,
    bold: false,
    italic: true,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00333333',
    shadowColor: '&H00000000',
    outline: 1,
    shadow: 3,
    alignment: 2,
    dt: { fontsize: 46, fontcolor: 'white', borderw: 2, bordercolor: 'black@0.3', shadowx: 3, shadowy: 3, shadowcolor: 'black@0.5', box: 1, boxcolor: 'black@0.35' },
    preview: { bg: 'bg-slate-900', text: 'Aa', textColor: 'text-white italic font-serif', border: 'border-purple-700' },
  },
  {
    id: 'neon',
    label: 'Neón',
    fontName: 'Arial',
    fontSize: 52,
    bold: true,
    italic: false,
    primaryColor: '&H00FFFF00',
    outlineColor: '&H00FF00B4',
    shadowColor: '&H00000000',
    outline: 2,
    shadow: 0,
    alignment: 2,
    dt: { fontsize: 56, fontcolor: 'cyan', borderw: 3, bordercolor: 'magenta@0.8', shadowx: 0, shadowy: 0, shadowcolor: 'black@0.0', box: 0, boxcolor: 'black@0.0' },
    preview: { bg: 'bg-black', text: 'Aa', textColor: 'text-cyan-400 font-bold', border: 'border-cyan-700' },
  },
];

export function getSubtitleStyle(id: string): SubtitleStyle {
  return SUBTITLE_STYLES.find((s) => s.id === id) ?? SUBTITLE_STYLES[0];
}
