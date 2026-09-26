/*
 * Movement and collision against the tile grid.
 * Speeds are in pixels per frame at 60 frames per second.
 */

import { COLS, ROWS, TILE, isSolid } from './level'

export const PHYSICS = {
    walkSpeed: 2,
    runSpeed: 3.2,
    accel: 0.14,
    turnAccel: 0.3,
    groundFriction: 0.14,
    airFriction: 0.04,
    jumpVelocity: 5.6,
    // Holding jump while rising gives a higher jump.
    gravityHeld: 0.2,
    gravity: 0.55,
    maxFall: 7,
}

export interface Body {
    x: number
    y: number
    w: number
    h: number
    vx: number
    vy: number
    onGround: boolean
}

export interface HeadBump {
    col: number
    row: number
}

const tileAt = (tiles: string[][], col: number, row: number) => {
    if (col < 0 || col >= COLS) return 'X' // level edges act as walls
    if (row < 0 || row >= ROWS) return '.'
    return tiles[row][col]
}

const solidAt = (tiles: string[][], col: number, row: number) => isSolid(tileAt(tiles, col, row))

// Moves the body by its velocity, stopping at solid tiles.
// Returns the tile the player's head hit this frame, if any.
export function moveBody(body: Body, tiles: string[][]): HeadBump | null {
    // Horizontal.
    body.x += body.vx
    const top = Math.floor(body.y / TILE)
    const bottom = Math.floor((body.y + body.h - 0.01) / TILE)
    if (body.vx > 0) {
        const col = Math.floor((body.x + body.w) / TILE)
        for (let row = top; row <= bottom; row++) {
            if (solidAt(tiles, col, row)) {
                body.x = col * TILE - body.w
                body.vx = 0
                break
            }
        }
    } else if (body.vx < 0) {
        const col = Math.floor(body.x / TILE)
        for (let row = top; row <= bottom; row++) {
            if (solidAt(tiles, col, row)) {
                body.x = (col + 1) * TILE
                body.vx = 0
                break
            }
        }
    }

    // Vertical.
    body.onGround = false
    body.y += body.vy
    const left = Math.floor(body.x / TILE)
    const right = Math.floor((body.x + body.w - 0.01) / TILE)
    if (body.vy > 0) {
        const row = Math.floor((body.y + body.h) / TILE)
        for (let col = left; col <= right; col++) {
            if (solidAt(tiles, col, row)) {
                body.y = row * TILE - body.h
                body.vy = 0
                body.onGround = true
                break
            }
        }
    } else if (body.vy < 0) {
        const row = Math.floor(body.y / TILE)
        const hits: number[] = []
        for (let col = left; col <= right; col++) {
            if (solidAt(tiles, col, row)) hits.push(col)
        }
        if (hits.length > 0) {
            body.y = (row + 1) * TILE
            body.vy = 0
            // Bump the block closest to the centre of the player's head.
            const centre = body.x + body.w / 2
            const col = hits.reduce((best, c) =>
                Math.abs((c + 0.5) * TILE - centre) < Math.abs((best + 0.5) * TILE - centre) ? c : best
            )
            return { col, row }
        }
    }
    return null
}

// Tiles the body overlaps (used for collecting coins).
export function overlappingTiles(body: Body): HeadBump[] {
    const result: HeadBump[] = []
    const left = Math.floor(body.x / TILE)
    const right = Math.floor((body.x + body.w - 0.01) / TILE)
    const top = Math.floor(body.y / TILE)
    const bottom = Math.floor((body.y + body.h - 0.01) / TILE)
    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) result.push({ col, row })
        }
    }
    return result
}
