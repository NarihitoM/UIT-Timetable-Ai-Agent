export interface SectionDef {
    key: string;
    file: string;
    command: string;
    aliases?: string[];
}

// Single source of truth for every timetable section: its internal key, its data
// file, its Telegram command, and any bare-word aliases the supervisor should match.
export const SECTIONS: SectionDef[] = [
    { key: "Sem2A", file: "Sem2A.txt", command: "/sem2_a", aliases: ["sem2a"] },
    { key: "Sem2B", file: "Sem2B.txt", command: "/sem2_b", aliases: ["sem2b"] },
    { key: "Sem2C", file: "Sem2C.txt", command: "/sem2_c", aliases: ["sem2c"] },
    { key: "Sem2D", file: "Sem2D.txt", command: "/sem2_d", aliases: ["sem2d"] },
    { key: "Sem2E", file: "Sem2E.txt", command: "/sem2_e", aliases: ["sem2e"] },
    { key: "Sem4A", file: "Sem4A.txt", command: "/sem4_a", aliases: ["sem4a"] },
    { key: "Sem4B", file: "Sem4B.txt", command: "/sem4_b", aliases: ["sem4b"] },
    { key: "Sem4C", file: "Sem4C.txt", command: "/sem4_c", aliases: ["sem4c"] },
    { key: "Sem4D", file: "Sem4D.txt", command: "/sem4_d", aliases: ["sem4d"] },
    { key: "Sem6CT", file: "Sem6_CT.txt", command: "/sem6_ct", aliases: ["sem6ct"] },
    { key: "Sem6A_CS", file: "Sem6A_CS.txt", command: "/sem6_a_cs", aliases: ["sem6acs"] },
    { key: "Sem6B_CS", file: "Sem6B_CS.txt", command: "/sem6_b_cs", aliases: ["sem6bcs"] },
    { key: "Sem6C_CS", file: "Sem6C_CS.txt", command: "/sem6_c_cs", aliases: ["sem6ccs"] },
    { key: "Sem6D_CS", file: "Sem6D_CS.txt", command: "/sem6_d_cs", aliases: ["sem6dcs"] },
    { key: "Sem8SE", file: "Sem8_SE.txt", command: "/sem8_se", aliases: ["sem8se"] },
    { key: "Sem8KE", file: "Sem8_KE.txt", command: "/sem8_ke", aliases: ["sem8ke"] },
    { key: "Sem8HPC", file: "Sem8_HPC.txt", command: "/sem8_hpc", aliases: ["sem8hpc"] },
    { key: "Sem8ES", file: "Sem8_ES.txt", command: "/sem8_es", aliases: ["sem8es"] },
    { key: "Sem8CCN", file: "Sem8_CCN.txt", command: "/sem8_ccn", aliases: ["sem8ccn"] },
    { key: "Sem8BIS", file: "Sem8_BIS.txt", command: "/sem8_bis", aliases: ["sem8bis"] },
];

export const FILE_NAMES: Record<string, string> = Object.fromEntries(
    SECTIONS.map(s => [s.key, s.file])
);

export function sectionMatchPattern(s: SectionDef): RegExp {
    const tokens = [s.command.replace(/^\//, ""), ...(s.aliases ?? [])];
    return new RegExp(tokens.join("|"), "i");
}

export const DATA_DIR = "src/data";
export const RATE_LIMIT_SECONDS = 15;
export const MODEL_RETRY_ATTEMPTS = 3;
export const MODEL_RETRY_BASE_MS = 300;
export const TYPING_REFRESH_MS = 4000;
