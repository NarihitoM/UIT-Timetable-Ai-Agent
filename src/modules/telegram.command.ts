import { SECTIONS } from "../constants.ts";

class Telegramcommand {
    // Section commands are derived from SECTIONS in constants.ts (single source of
    // truth). /room is appended last — the controller's commands.slice(4) assumes
    // everything from index 4 onward, including /room, is a rate-limited command.
    static commands = [
        "/start",
        "/help",
        "/contributors",
        "/sourcecode",
        ...SECTIONS.map(s => s.command),
        "/room",
    ]
}

export {
    Telegramcommand
}