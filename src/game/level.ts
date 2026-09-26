/*
 * The levels.
 *
 * Each level is a grid of 16x16 tiles, 15 rows tall (row 0 is the top, rows 13-14 are the ground).
 * Each tile is one character:
 *
 *   .  empty                 #  ground
 *   B  brick                 X  hard block (stairs, flagpole base)
 *   ?  coin block            U  used (empty) block
 *   M  power block: looks like ?, holds a cup of coffee
 *   A  "About me" block      a  used "About me" block (bump again to reopen)
 *   P  project block         p  used project block (bump again to reopen)
 *   [ ]  pipe top            { }  pipe body
 *   W  top-left of the pipe you can enter (the "Work" pipe)
 *   o  coin to collect
 *
 * World 1-1 is the website: its blocks and pipe open the site's sections, and nothing can hurt you.
 * World 1-2 is just a game: enemies, pits that cost a life, a timer and a checkpoint.
 * World 1-3 is a boss fight against The Manager, in his office.
 */

export const TILE = 16
export const ROWS = 15

export type LevelId = 1 | 2 | 3
export type Section = 'about' | 'work' | 'project' | 'contact'
export type EnemyKind = 'bug' | 'shredder'

export interface Label {
    // Centre of the label, in tiles.
    col: number
    row: number
    text: string
    arrow?: boolean
}

export interface Decor {
    kind: 'hill' | 'bush'
    col: number
    row: number
    size: number
}

export interface EnemySpawn {
    kind: EnemyKind
    col: number
    // The row the enemy stands on (defaults to just above the ground).
    row?: number
}

export interface Level {
    id: LevelId
    name: string
    // 'site' levels open the website's sections; 'challenge' levels have enemies, lives and a timer;
    // 'boss' levels are a challenge level with The Manager in it.
    mode: 'site' | 'challenge' | 'boss'
    cols: number
    tiles: string[][]
    start: { col: number; row: number }
    flagCol?: number
    castleCol?: number
    bossCol?: number
    checkpointCol?: number
    time?: number
    labels: Label[]
    decor: Decor[]
    enemies: EnemySpawn[]
}

const SOLID = 'B?MAaPpUX#[]{}W'

export const isSolid = (tile: string | undefined) => tile !== undefined && tile !== '' && SOLID.includes(tile)

// An empty grid plus helpers for placing things on it.
function createGrid(cols: number) {
    const tiles: string[][] = []
    for (let r = 0; r < ROWS; r++) {
        tiles.push(new Array(cols).fill('.'))
    }

    const set = (col: number, row: number, tile: string) => {
        tiles[row][col] = tile
    }
    return {
        tiles,
        set,
        // Writes a string of tiles left-to-right starting at (col, row). Spaces are skipped.
        put: (col: number, row: number, text: string) => {
            text.split('').forEach((tile, i) => tile !== ' ' && set(col + i, row, tile))
        },
        ground: (from: number, to: number) => {
            for (let c = from; c <= to; c++) {
                set(c, 13, '#')
                set(c, 14, '#')
            }
        },
        pipe: (col: number, height: number, enterable = false) => {
            const top = 13 - height
            set(col, top, enterable ? 'W' : '[')
            set(col + 1, top, ']')
            for (let r = top + 1; r < 13; r++) {
                set(col, r, '{')
                set(col + 1, r, '}')
            }
        },
        // A staircase of hard blocks. `heights` lists the height of each column, left to right.
        stairs: (col: number, heights: number[]) => {
            heights.forEach((height, i) => {
                for (let r = 13 - height; r <= 12; r++) set(col + i, r, 'X')
            })
        },
    }
}

export function buildLevel(id: LevelId): Level {
    if (id === 1) return buildWorld1()
    if (id === 2) return buildWorld2()
    return buildWorld3()
}

function buildWorld1(): Level {
    const cols = 112
    const { tiles, set, put, ground, pipe, stairs } = createGrid(cols)

    // Ground, with one pit to jump over.
    ground(0, 37)
    ground(41, cols - 1)

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

    // The coffee (power-up) comes just before halfway, right before the projects.
    put(43, 9, 'M')

    // Projects: one block per project.
    put(46, 9, 'PBPBPBP')

    // A high platform with bonus coins.
    put(56, 5, 'BBBBB')
    put(57, 4, 'ooo')

    pipe(64, 4)
    put(70, 9, '?B?')
    put(71, 5, '?')

    // Staircase up to the flag.
    stairs(80, [1, 2, 3, 4, 5, 6, 7, 8])

    // Flagpole base.
    const flagCol = 96
    set(flagCol, 12, 'X')

    return {
        id: 1,
        name: '1-1',
        mode: 'site',
        cols,
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
        ],
        enemies: [],
    }
}

function buildWorld2(): Level {
    const cols = 212
    const { tiles, set, put, ground, pipe, stairs } = createGrid(cols)

    // Ground in segments; the gaps are pits.
    ground(0, 68)
    ground(71, 86)
    ground(90, 137)
    ground(140, 162)
    ground(166, cols - 1)

    // Opening blocks.
    put(10, 9, '?')
    put(14, 9, 'B?B?B')
    put(16, 5, 'M')

    // A run of pipes, each taller than the last, with enemies in between.
    pipe(24, 2)
    pipe(34, 3)
    pipe(44, 4)
    pipe(55, 4)
    put(60, 8, 'oooo')

    // Over the first pit to a high platform.
    put(76, 9, 'B?B')
    put(79, 5, 'BBBBBBBB')
    put(80, 4, 'oo  oo')

    // Across the second pit.
    put(92, 5, 'BBB?')
    put(95, 9, '?')
    put(100, 9, 'BB')

    // Past the checkpoint: a block triangle.
    put(112, 9, '?  ?  ?')
    put(115, 5, 'M')
    put(124, 9, 'B')
    put(127, 5, 'BBB')
    put(130, 5, 'B??B')

    // A stair pyramid with a pit in the middle.
    stairs(134, [1, 2, 3, 4])
    stairs(140, [4, 3, 2, 1])

    pipe(158, 2)
    put(162, 8, 'ooo')

    put(168, 9, 'BB?B')
    put(168, 5, 'oooo')
    pipe(175, 2)

    // The big staircase to the flag.
    stairs(180, [1, 2, 3, 4, 5, 6, 7, 8, 8])

    const flagCol = 193
    set(flagCol, 12, 'X')

    // Hills and bushes repeat every 48 columns, like the old games. (Clouds and mountains are drawn by the engine.)
    const decor: Decor[] = []
    for (let base = 0; base < cols; base += 48) {
        decor.push(
            { kind: 'hill', col: base, row: 13, size: 3 },
            { kind: 'hill', col: base + 16, row: 13, size: 2 },
            { kind: 'bush', col: base + 11, row: 13, size: 3 },
            { kind: 'bush', col: base + 41, row: 13, size: 1 }
        )
    }

    return {
        id: 2,
        name: '1-2',
        mode: 'challenge',
        cols,
        tiles,
        start: { col: 3, row: 12 },
        flagCol,
        castleCol: 198,
        checkpointCol: 108,
        time: 300,
        labels: [],
        decor,
        enemies: [
            { kind: 'bug', col: 21 },
            { kind: 'bug', col: 30 },
            { kind: 'bug', col: 40 },
            { kind: 'bug', col: 41.5 },
            { kind: 'bug', col: 50 },
            { kind: 'bug', col: 52 },
            { kind: 'bug', col: 64 },
            { kind: 'bug', col: 83, row: 4 },
            { kind: 'bug', col: 97 },
            { kind: 'bug', col: 99 },
            { kind: 'shredder', col: 106 },
            { kind: 'bug', col: 120 },
            { kind: 'bug', col: 122 },
            { kind: 'shredder', col: 128, row: 4 },
            { kind: 'shredder', col: 148 },
            { kind: 'bug', col: 152 },
            { kind: 'bug', col: 154 },
            { kind: 'bug', col: 170 },
            { kind: 'shredder', col: 178 },
        ],
    }
}

function buildWorld3(): Level {
    const cols = 30
    const { tiles, set, put, ground } = createGrid(cols)

    // The Manager's office: a floor, walls at both ends, and platforms to dodge staples from.
    ground(0, cols - 1)
    for (let r = 0; r < 13; r++) {
        set(0, r, 'X')
        set(cols - 1, r, 'X')
    }
    put(4, 9, 'BBBB')
    put(22, 9, 'BBBB')
    put(14, 9, 'M')
    put(11, 5, 'BBBBBBBB')
    put(12, 4, 'oooooo')

    return {
        id: 3,
        name: '1-3',
        mode: 'boss',
        cols,
        tiles,
        start: { col: 3, row: 12 },
        bossCol: 24,
        time: 300,
        labels: [],
        decor: [],
        enemies: [],
    }
}
