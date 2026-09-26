/*
 * World 1-1: the level layout.
 *
 * The level is a grid of 16x16 tiles, 15 rows tall (row 0 is the top, rows 13-14 are the ground).
 * Each tile is one character:
 *
 *   .  empty                 #  ground
 *   B  brick                 X  hard block (stairs, flagpole base)
 *   ?  coin block            U  used (empty) block
 *   A  "About me" block      a  used "About me" block (bump again to reopen)
 *   P  project block         p  used project block (bump again to reopen)
 *   [ ]  pipe top            { }  pipe body
 *   W  top-left of the pipe you can enter (the "Work" pipe)
 *   o  coin to collect
 */

export const TILE = 16
export const ROWS = 15
export const COLS = 112

export type Section = 'about' | 'work' | 'project' | 'contact'

export interface Label {
    // Centre of the label, in tiles.
    col: number
    row: number
    text: string
    arrow?: boolean
}

export interface Decor {
    kind: 'cloud' | 'hill' | 'bush'
    col: number
    row: number
    size: number
}

export interface Level {
    tiles: string[][]
    start: { col: number; row: number }
    flagCol: number
    castleCol: number
    labels: Label[]
    decor: Decor[]
}

const SOLID = 'B?AaPpUX#[]{}W'

export const isSolid = (tile: string | undefined) => tile !== undefined && tile !== '' && SOLID.includes(tile)

export function buildLevel(): Level {
    const tiles: string[][] = []
    for (let r = 0; r < ROWS; r++) {
        tiles.push(new Array(COLS).fill('.'))
    }

    const set = (col: number, row: number, tile: string) => {
        tiles[row][col] = tile
    }
    // Writes a string of tiles left-to-right starting at (col, row). Spaces are skipped.
    const put = (col: number, row: number, text: string) => {
        text.split('').forEach((tile, i) => tile !== ' ' && set(col + i, row, tile))
    }
    const ground = (from: number, to: number) => {
        for (let c = from; c <= to; c++) {
            set(c, 13, '#')
            set(c, 14, '#')
        }
    }
    const pipe = (col: number, height: number, enterable = false) => {
        const top = 13 - height
        set(col, top, enterable ? 'W' : '[')
        set(col + 1, top, ']')
        for (let r = top + 1; r < 13; r++) {
            set(col, r, '{')
            set(col + 1, r, '}')
        }
    }

    // Ground, with one pit to jump over.
    ground(0, 37)
    ground(41, COLS - 1)

    // A lone coin block to learn on, then the About Me block.
    put(6, 9, '?')
    put(10, 9, 'B?A?B')

    // Coins, a small pipe, then the Work pipe.
    put(17, 11, 'ooo')
    pipe(22, 2)
    put(26, 8, 'oo')
    pipe(30, 3, true)

    // Coins arcing over the pit.
    put(38, 9, 'ooo')

    // Projects: one block per project.
    put(46, 9, 'PBPBPBP')

    // A high platform with bonus coins.
    put(56, 5, 'BBBBB')
    put(57, 4, 'ooo')

    pipe(64, 4)
    put(70, 9, '?B?')
    put(71, 5, '?')

    // Staircase up to the flag.
    for (let i = 0; i < 8; i++) {
        for (let r = 12 - i; r <= 12; r++) {
            set(80 + i, r, 'X')
        }
    }

    // Flagpole base.
    const flagCol = 96
    set(flagCol, 12, 'X')

    return {
        tiles,
        start: { col: 3, row: 12 },
        flagCol,
        castleCol: 101,
        labels: [
            { col: 12.5, row: 7.2, text: 'ABOUT ME' },
            { col: 31, row: 6.6, text: 'WORK', arrow: true },
            { col: 49.5, row: 7.2, text: 'PROJECTS' },
            { col: 96.5, row: 1, text: 'CONTACT' },
        ],
        decor: [
            { kind: 'hill', col: 0, row: 13, size: 3 },
            { kind: 'hill', col: 16, row: 13, size: 2 },
            { kind: 'hill', col: 48, row: 13, size: 3 },
            { kind: 'hill', col: 64, row: 13, size: 2 },
            { kind: 'hill', col: 90, row: 13, size: 3 },
            { kind: 'bush', col: 12, row: 13, size: 3 },
            { kind: 'bush', col: 25, row: 13, size: 1 },
            { kind: 'bush', col: 42, row: 13, size: 2 },
            { kind: 'bush', col: 74, row: 13, size: 3 },
            { kind: 'cloud', col: 8, row: 2, size: 1 },
            { kind: 'cloud', col: 20, row: 3, size: 1 },
            { kind: 'cloud', col: 28, row: 1.5, size: 3 },
            { kind: 'cloud', col: 38, row: 2.5, size: 2 },
            { kind: 'cloud', col: 60, row: 1, size: 1 },
            { kind: 'cloud', col: 68, row: 2, size: 2 },
            { kind: 'cloud', col: 86, row: 1.5, size: 1 },
            { kind: 'cloud', col: 104, row: 2, size: 2 },
        ],
    }
}
