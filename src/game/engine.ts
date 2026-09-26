/*
 * The game: input, the update loop, the camera and drawing.
 *
 * The React wrapper (components/GameCanvas) creates one Game per canvas,
 * and the game calls back into React when a site section should open
 * or when a World 1-2 or 1-3 run ends.
 */

import { Decor, EnemyKind, Level, LevelId, ROWS, Section, TILE, buildLevel, isSolid } from './level'
import { Body, PHYSICS, moveBody, overlappingTiles, overlaps } from './physics'
import { Sprites, Theme, buildSprites, shade } from './sprites'
import { sound } from './sound'
import { Track, music } from './music'
import { DEFEAT_LINE, HIT_LINES, OPENING_LINE, TAUNTS } from './taunts'

export type Control = 'left' | 'right' | 'up' | 'down' | 'jump' | 'run'

export interface RunResult {
    level: LevelId
    score: number
    coins: number
}

export interface GameCallbacks {
    onOpen: (section: Section, projectIndex?: number) => void
    onLevelComplete: (result: RunResult) => void
    onGameOver: (result: RunResult) => void
}

type State = 'title' | 'intro' | 'play' | 'grow' | 'pipeDown' | 'pipeUp' | 'flagSlide' | 'flagWalk' | 'dying' | 'panel'

// What to do when a panel is closed.
type ResumeAction = 'play' | 'pipeUp' | 'castleExit'

interface Bump {
    col: number
    row: number
    frame: number
}

interface Enemy extends Body {
    kind: EnemyKind
    dir: 1 | -1
    speed: number
    // Boss-fight bugs run across the room once and vanish at the far wall.
    crossing: boolean
    mode: 'walk' | 'flat' | 'knocked'
    timer: number
    active: boolean
    dead: boolean
}

// The Manager, boss of World 1-3.
interface Boss extends Body {
    hp: number
    dir: 1 | -1
    mode: 'walk' | 'aim' | 'defeated'
    timer: number
    // Frames of flashing after being stomped (he can't be hit, or hurt you, meanwhile).
    hurt: number
    // Staples left to fire in the current volley.
    burst: number
    shootIn: number
    jumpIn: number
    tauntIn: number
    taunt: string
    tauntFrames: number
}

interface Staple {
    x: number
    y: number
    vx: number
    dead: boolean
}

// A cup of coffee sliding along the ground.
interface Item extends Body {
    dir: 1 | -1
    // Frames left of rising out of its block.
    rising: number
    dead: boolean
}

interface Debris {
    x: number
    y: number
    vx: number
    vy: number
    frame: number
}

interface Popup {
    x: number
    y: number
    text: string
    frame: number
}

interface CoinPop {
    x: number
    y: number
    vy: number
    frame: number
}

const STEP = 1000 / 60
// Always show at least this many tiles across, so narrow phone screens aren't zoomed right in.
const MIN_VIEW_COLS = 16
// Space kept below the level for the on-screen buttons on tall (portrait) touch screens, in CSS pixels.
const TOUCH_RESERVE = 110
const START_LIVES = 3
const SMALL_HEIGHT = 16
const BIG_HEIGHT = 30
// Frames of flashing (and no damage) after shrinking.
const INVINCIBLE_FRAMES = 120
// World 1-2 plays the music a little faster.
const CHALLENGE_TEMPO = 1.12
const BOSS_HP = 5
const BOSS_WIDTH = 18
const BOSS_HEIGHT = 40
const BUG_SPEED = 1.6
const ENEMY_SPEED = 0.5
// The in-game clock ticks once every 24 frames (0.4 seconds), like the old games.
const TIME_TICK = 24
const KEY_MAP: Record<string, Control> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'jump',
    KeyZ: 'jump',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyX: 'run',
}

export class Game {
    private readonly canvas: HTMLCanvasElement
    private readonly ctx: CanvasRenderingContext2D
    private readonly callbacks: GameCallbacks
    private level: Level
    private sprites: Sprites
    private theme: Theme

    private state: State = 'title'
    private resumeAction: ResumeAction = 'play'
    private controls: Record<Control, boolean> = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
    }
    private jumpWasDown = false
    private hasMoved = false
    private touchMode = false

    private player: Body = { x: 0, y: 0, w: 12, h: 16, vx: 0, vy: 0, onGround: true }
    private facing: 'left' | 'right' = 'right'
    private walkFrame = 0
    private lastSafe = { x: 0, y: 0 }
    private timer = 0
    private hidden = false
    private flagY = 3 * TILE
    private flagDone = false
    private big = false
    private invincible = 0
    private pipeFrames = 0

    private coins = 0
    private score = 0
    private lives = START_LIVES
    private time = 0
    private timeTick = 0
    private checkpointReached = false
    private enemies: Enemy[] = []
    private items: Item[] = []
    private debris: Debris[] = []
    private boss: Boss | null = null
    private staples: Staple[] = []
    private bugTimer = 0
    private popups: Popup[] = []
    private bumps: Bump[] = []
    private coinPops: CoinPop[] = []
    private projectIndexes: Record<string, number> = {}
    private stars: { x: number; y: number }[] = []

    private scale = 1
    private viewWidth = 0
    // Sky above the level, in level pixels (non-zero when the screen is taller than the level).
    private offsetY = 0
    private camX = 0
    private frame = 0
    private rafId = 0
    private lastTime = 0
    private accumulator = 0

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, theme: Theme, callbacks: GameCallbacks) {
        this.canvas = canvas
        this.ctx = ctx
        this.callbacks = callbacks
        this.theme = theme
        this.sprites = buildSprites(theme)
        this.level = buildLevel(1)
        this.resetLevel(false)
    }

    // ---- Public API ---------------------------------------------------------

    start() {
        window.addEventListener('keydown', this.handleKeyDown)
        window.addEventListener('keyup', this.handleKeyUp)
        window.addEventListener('blur', this.releaseAll)
        this.resize()
        this.lastTime = performance.now()
        this.rafId = requestAnimationFrame(this.tick)
    }

    stop() {
        music.stop()
        cancelAnimationFrame(this.rafId)
        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('blur', this.releaseAll)
    }

    // Leaves the title screen and hands control to the player.
    begin() {
        if (this.state !== 'title') return
        this.state = 'play'
        this.startMusic()
    }

    // Switches to a level. World 1-2 always starts a fresh run with full lives.
    loadLevel(id: LevelId) {
        this.level = buildLevel(id)
        this.checkpointReached = false
        this.score = 0
        this.lives = START_LIVES
        this.resetLevel(false)
        this.releaseAll()
        this.state = this.level.mode === 'site' ? 'play' : 'intro'
        this.timer = 0
        if (this.state === 'play') this.startMusic()
        else music.stop()
    }

    // Called when a panel is closed.
    resume() {
        if (this.state !== 'panel') return
        this.releaseAll()
        if (this.resumeAction === 'pipeUp') {
            this.state = 'pipeUp'
            this.timer = 0
        } else if (this.resumeAction === 'castleExit') {
            this.hidden = false
            this.state = 'play'
            this.startMusic()
        } else {
            this.state = 'play'
        }
    }

    setTheme(theme: Theme) {
        if (theme === this.theme) return
        this.theme = theme
        this.sprites = buildSprites(theme)
        music.switchTrack(this.track())
    }

    private track(): Track {
        const night = this.theme === 'dark'
        if (this.level.mode === 'boss') return night ? 'bossNight' : 'bossDay'
        return night ? 'night' : 'day'
    }

    private startMusic() {
        music.play(this.track(), this.level.mode === 'challenge' ? CHALLENGE_TEMPO : 1)
    }

    // Touch devices get shorter on-screen hints.
    setTouchMode(touch: boolean) {
        this.touchMode = touch
        this.resize()
    }

    setControl(control: Control, down: boolean) {
        this.controls[control] = down
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr))
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr))
        const reserve = this.touchMode && rect.height > rect.width ? TOUCH_RESERVE * dpr : 0
        const available = Math.max(1, this.canvas.height - reserve)
        this.scale = Math.min(available / (ROWS * TILE), this.canvas.width / (MIN_VIEW_COLS * TILE))
        this.viewWidth = this.canvas.width / this.scale
        this.offsetY = available / this.scale - ROWS * TILE
        this.updateCamera(true)
        this.draw()
    }

    // ---- Input --------------------------------------------------------------

    private handleKeyDown = (event: KeyboardEvent) => {
        const control = KEY_MAP[event.code]
        if (!control || this.state === 'panel' || this.state === 'title') return
        event.preventDefault()
        this.controls[control] = true
    }

    private handleKeyUp = (event: KeyboardEvent) => {
        const control = KEY_MAP[event.code]
        if (!control) return
        this.controls[control] = false
    }

    private releaseAll = () => {
        ;(Object.keys(this.controls) as Control[]).forEach((c) => (this.controls[c] = false))
    }

    // ---- Loop ---------------------------------------------------------------

    private tick = (now: number) => {
        // Cap the catch-up so a background tab doesn't fast-forward the game.
        this.accumulator += Math.min(now - this.lastTime, 250)
        this.lastTime = now
        while (this.accumulator >= STEP) {
            this.update()
            this.accumulator -= STEP
        }
        this.draw()
        this.rafId = requestAnimationFrame(this.tick)
    }

    private update() {
        this.frame++
        this.updateEffects()

        switch (this.state) {
            case 'intro':
                if (++this.timer >= 150) {
                    this.state = 'play'
                    this.startMusic()
                    if (this.boss) this.say(OPENING_LINE, 200)
                }
                break
            case 'play':
                this.updatePlay()
                if (this.state === 'play') {
                    this.updateEnemies()
                    this.updateItems()
                    this.updateBoss()
                    this.updateStaples()
                }
                break
            case 'grow':
                if (++this.timer >= 48) this.state = 'play'
                break
            case 'dying':
                this.updateDying()
                break
            case 'pipeDown':
                this.player.y += 0.8
                if (++this.timer >= this.pipeFrames) this.openSection('work', undefined, 'pipeUp')
                break
            case 'pipeUp':
                this.player.y -= 0.8
                if (++this.timer >= this.pipeFrames) {
                    this.player.y = Math.round(this.player.y)
                    this.state = 'play'
                }
                break
            case 'flagSlide':
                this.updateFlagSlide()
                break
            case 'flagWalk':
                this.updateFlagWalk()
                break
        }
        this.updateCamera(false)
    }

    private updatePlay() {
        const p = this.player
        const c = this.controls
        // Worlds 1-2 and 1-3 both have enemies, lives and a timer.
        const challenge = this.level.mode !== 'site'
        const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0)
        const maxSpeed = c.run ? PHYSICS.runSpeed : PHYSICS.walkSpeed

        if (dir !== 0) {
            this.hasMoved = true
            const turning = Math.sign(p.vx) === -dir
            p.vx += dir * (turning ? PHYSICS.turnAccel : PHYSICS.accel)
            this.facing = dir > 0 ? 'right' : 'left'
        } else {
            const friction = p.onGround ? PHYSICS.groundFriction : PHYSICS.airFriction
            p.vx = Math.abs(p.vx) <= friction ? 0 : p.vx - Math.sign(p.vx) * friction
        }
        p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx))

        const jumpDown = c.jump || c.up
        if (jumpDown && !this.jumpWasDown && p.onGround) {
            p.vy = -(PHYSICS.jumpVelocity + Math.abs(p.vx) * 0.2)
            this.hasMoved = true
            sound.play('jump')
        }
        this.jumpWasDown = jumpDown

        const gravity = p.vy < 0 && jumpDown ? PHYSICS.gravityHeld : PHYSICS.gravity
        p.vy = Math.min(p.vy + gravity, PHYSICS.maxFall)

        const prevBottom = p.y + p.h
        const bump = moveBody(p, this.level.tiles)
        if (bump) this.bumpTile(bump.col, bump.row)
        if (challenge) this.touchEnemies(prevBottom, jumpDown)
        if (this.state === 'play') this.touchBoss(prevBottom, jumpDown)
        if (this.state !== 'play') return

        if (this.invincible > 0) this.invincible--
        if (p.onGround) this.lastSafe = { x: p.x, y: p.y }
        this.walkFrame = p.onGround && p.vx !== 0 ? this.walkFrame + Math.abs(p.vx) * 0.12 : 0

        this.collectCoins()

        if (p.y > ROWS * TILE + 32) {
            if (challenge) {
                this.die()
                return
            }
            // World 1-1 is forgiving: put the player back where they last stood.
            p.x = this.lastSafe.x
            p.y = this.lastSafe.y
            p.vx = 0
            p.vy = 0
        }

        if (challenge) {
            const { checkpointCol } = this.level
            if (checkpointCol !== undefined && !this.checkpointReached && p.x > checkpointCol * TILE) {
                this.checkpointReached = true
                this.popups.push({ x: checkpointCol * TILE, y: 9 * TILE, text: 'CHECKPOINT', frame: 0 })
                sound.play('open')
            }
            if (++this.timeTick >= TIME_TICK) {
                this.timeTick = 0
                this.time--
                if (this.time <= 0) {
                    this.die()
                    return
                }
            }
        }

        if (p.onGround && c.down && this.isOnWorkPipe()) {
            this.state = 'pipeDown'
            this.timer = 0
            // Sink far enough to disappear completely, small or tall.
            this.pipeFrames = Math.ceil((p.h + 2) / 0.8)
            p.vx = 0
            sound.play('pipe')
        }

        const { flagCol } = this.level
        if (flagCol === undefined) return
        const poleX = flagCol * TILE + 7
        if (this.flagDone && p.x < poleX - 3 * TILE) {
            // Walked back past the pole: raise the flag so it can be replayed.
            this.flagDone = false
            this.flagY = 3 * TILE
        }
        // Touching the pole or its base block grabs the flag.
        if (!this.flagDone && p.x + p.w >= flagCol * TILE - 1) {
            this.flagDone = true
            this.state = 'flagSlide'
            if (challenge) {
                // Grab the pole higher for a bigger bonus.
                const bonus = Math.max(1, Math.round((12 * TILE - p.y) / TILE)) * 100
                this.addScore(bonus, poleX, p.y)
            }
            p.x = poleX - p.w + 1
            p.vx = 0
            p.vy = 0
            this.facing = 'right'
            music.stop()
            sound.play('flag')
        }
    }

    private updateFlagSlide() {
        const p = this.player
        const baseTop = 12 * TILE
        p.y = Math.min(p.y + 2, baseTop - p.h)
        this.flagY = Math.min(this.flagY + 2, baseTop - 12)
        if (p.y >= baseTop - p.h && this.flagY >= baseTop - 12) {
            this.state = 'flagWalk'
            p.x = (this.level.flagCol ?? 0) * TILE + TILE
        }
    }

    private updateFlagWalk() {
        const p = this.player
        p.vx = 1.2
        p.vy = Math.min(p.vy + PHYSICS.gravity, PHYSICS.maxFall)
        moveBody(p, this.level.tiles)
        this.walkFrame += 0.15
        const doorX = ((this.level.castleCol ?? 0) + 2) * TILE
        if (p.x < doorX) return

        p.vx = 0
        this.hidden = true
        if (this.level.mode !== 'site') {
            this.completeLevel()
        } else {
            this.openSection('contact', undefined, 'castleExit')
        }
    }

    private completeLevel() {
        // Time left over turns into points.
        this.score += this.time * 50
        this.time = 0
        this.state = 'panel'
        this.callbacks.onLevelComplete({ level: this.level.id, score: this.score, coins: this.coins })
    }

    private openSection(section: Section, projectIndex: number | undefined, then: ResumeAction) {
        this.state = 'panel'
        this.resumeAction = then
        this.player.vx = 0
        sound.play('open')
        this.callbacks.onOpen(section, projectIndex)
    }

    // ---- Lives and levels ---------------------------------------------------

    // Rebuilds the current level and puts the player at the start (or at the checkpoint).
    private resetLevel(atCheckpoint: boolean) {
        this.level = buildLevel(this.level.id)
        const { start, checkpointCol } = this.level
        const startCol = atCheckpoint && checkpointCol !== undefined ? checkpointCol : start.col
        this.player = { x: startCol * TILE + 2, y: start.row * TILE, w: 12, h: SMALL_HEIGHT, vx: 0, vy: 0, onGround: true }
        this.big = false
        this.invincible = 0
        this.items = []
        this.debris = []
        this.staples = []
        this.bugTimer = 240
        const { bossCol } = this.level
        this.boss =
            bossCol === undefined
                ? null
                : {
                      x: bossCol * TILE,
                      y: 13 * TILE - BOSS_HEIGHT,
                      w: BOSS_WIDTH,
                      h: BOSS_HEIGHT,
                      vx: 0,
                      vy: 0,
                      onGround: true,
                      hp: BOSS_HP,
                      dir: -1,
                      mode: 'walk',
                      timer: 0,
                      hurt: 0,
                      burst: 0,
                      shootIn: 150,
                      jumpIn: 240,
                      tauntIn: 420,
                      taunt: '',
                      tauntFrames: 0,
                  }
        this.lastSafe = { x: this.player.x, y: this.player.y }
        this.facing = 'right'
        this.walkFrame = 0
        this.hidden = false
        this.flagDone = false
        this.flagY = 3 * TILE
        this.time = this.level.time ?? 0
        this.timeTick = 0
        this.bumps = []
        this.coinPops = []
        this.popups = []
        this.enemies = this.level.enemies
            // Never start an enemy right next to the player.
            .filter((spawn) => spawn.col > startCol + 6)
            .map((spawn) => ({
                kind: spawn.kind,
                x: spawn.col * TILE + 2,
                y: ((spawn.row ?? 12) + 1) * TILE - 12,
                w: 12,
                h: 12,
                vx: 0,
                vy: 0,
                onGround: false,
                dir: -1 as const,
                speed: ENEMY_SPEED,
                crossing: false,
                mode: 'walk' as const,
                timer: 0,
                active: false,
                dead: false,
            }))
        this.projectIndexes = {}
        this.indexProjects()
        this.makeStars()
        this.updateCamera(true)
    }

    // Grows or shrinks the player, keeping their feet where they are.
    private setBig(big: boolean) {
        const p = this.player
        const height = big ? BIG_HEIGHT : SMALL_HEIGHT
        p.y += p.h - height
        p.h = height
        this.big = big
    }

    // An enemy touched the player: tall Fred shrinks, small Fred loses a life.
    private hurt() {
        if (this.invincible > 0) return
        if (this.big) {
            this.setBig(false)
            this.invincible = INVINCIBLE_FRAMES
            sound.play('shrink')
            return
        }
        this.die()
    }

    private die() {
        music.stop()
        this.state = 'dying'
        this.timer = 0
        this.player.vx = 0
        this.player.vy = 0
        sound.play('die')
    }

    private updateDying() {
        const p = this.player
        this.timer++
        // Pause, hop up, then fall off the screen (unless already down a pit).
        if (this.timer === 30 && p.y < ROWS * TILE) p.vy = -5
        if (this.timer > 30) {
            p.vy += 0.25
            p.y += p.vy
        }
        if (this.timer < 170) return

        this.lives--
        if (this.lives <= 0) {
            this.state = 'panel'
            sound.play('gameover')
            this.callbacks.onGameOver({ level: this.level.id, score: this.score, coins: this.coins })
        } else {
            this.resetLevel(this.checkpointReached)
            this.state = 'intro'
            this.timer = 0
        }
    }

    private addScore(points: number, x: number, y: number) {
        this.score += points
        this.popups.push({ x, y, text: String(points), frame: 0 })
    }

    // ---- Enemies ------------------------------------------------------------

    private updateEnemies() {
        // Enemies wake up just before they scroll into view.
        const wakeX = this.camX + this.viewWidth + TILE
        this.enemies.forEach((e) => {
            if (!e.active && e.x < wakeX) e.active = true
            if (!e.active) return
            if (e.mode === 'flat') {
                if (++e.timer > 30) e.dead = true
                return
            }
            if (e.mode === 'knocked') {
                e.vy += 0.3
                e.x += e.vx
                e.y += e.vy
            } else {
                e.vx = e.dir * e.speed
                e.vy = Math.min(e.vy + PHYSICS.gravity, PHYSICS.maxFall)
                moveBody(e, this.level.tiles)
                // Hit a wall or pipe: turn around (or, for a bug crossing the boss room, vanish).
                if (e.vx === 0) {
                    if (e.crossing) e.dead = true
                    e.dir = e.dir === 1 ? -1 : 1
                }
            }
            if (e.y > ROWS * TILE + 32 || e.x < this.camX - 8 * TILE) e.dead = true
        })

        // Enemies that bump into each other turn around.
        const walking = this.enemies.filter((e) => e.active && e.mode === 'walk')
        for (let i = 0; i < walking.length; i++) {
            for (let j = i + 1; j < walking.length; j++) {
                const a = walking[i]
                const b = walking[j]
                if (!overlaps(a, b)) continue
                const [left, right] = a.x < b.x ? [a, b] : [b, a]
                left.dir = -1
                right.dir = 1
            }
        }

        this.enemies = this.enemies.filter((e) => !e.dead)
    }

    private touchEnemies(prevBottom: number, jumpDown: boolean) {
        const p = this.player
        for (const e of this.enemies) {
            if (!e.active || e.mode !== 'walk' || !overlaps(p, e)) continue
            // Landing on top counts as a stomp; touching from the side (or stomping spikes) hurts.
            const stomped = prevBottom <= e.y + 4
            if (stomped && e.kind === 'bug') {
                e.mode = 'flat'
                e.timer = 0
                p.vy = jumpDown ? -6.5 : -4
                this.addScore(100, e.x, e.y - 8)
                sound.play('stomp')
            } else {
                this.hurt()
                if (this.state !== 'play') return
            }
        }
    }

    // ---- The boss -----------------------------------------------------------

    private say(text: string, frames = 180) {
        if (!this.boss) return
        this.boss.taunt = text
        this.boss.tauntFrames = frames
    }

    private pick<T>(list: T[], avoid?: T): T {
        const options = list.length > 1 ? list.filter((item) => item !== avoid) : list
        return options[Math.floor(Math.random() * options.length)]
    }

    private updateBoss() {
        const b = this.boss
        if (!b) return
        const p = this.player
        if (b.tauntFrames > 0) b.tauntFrames--

        if (b.mode === 'defeated') {
            // Falls off the bottom of the screen, then the level ends.
            b.vy += 0.25
            b.y += b.vy
            if (++b.timer === 210) this.completeLevel()
            return
        }

        // He gets faster and angrier with every hit.
        const anger = 1 + (BOSS_HP - b.hp) * 0.18
        if (b.hurt > 0) b.hurt--

        if (--b.tauntIn <= 0) {
            this.say(this.pick(TAUNTS, b.taunt))
            b.tauntIn = 420 + Math.random() * 300
        }

        if (b.mode === 'walk') {
            b.vx = b.dir * 0.7 * anger
            if (Math.random() < 0.004) b.dir = b.dir === 1 ? -1 : 1
            if (b.onGround && --b.jumpIn <= 0) {
                b.vy = -6
                b.jumpIn = 150 + Math.random() * 150
            }
            if (--b.shootIn <= 0) {
                b.mode = 'aim'
                b.timer = 36
                b.burst = b.hp <= 2 ? 3 : b.hp <= 4 ? 2 : 1
            }
        } else {
            // Stop, turn to face the player, and fire a volley of staples.
            b.vx = 0
            b.dir = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1
            if (--b.timer <= 0) {
                this.fireStaple(b)
                b.burst--
                if (b.burst > 0) b.timer = 16
                else {
                    b.mode = 'walk'
                    b.shootIn = (100 + Math.random() * 80) / anger
                }
            }
        }

        b.vy = Math.min(b.vy + PHYSICS.gravity, PHYSICS.maxFall)
        moveBody(b, this.level.tiles)
        if (b.mode === 'walk' && b.vx === 0) b.dir = b.dir === 1 ? -1 : 1

        // Every so often a bug scuttles across the room.
        if (--this.bugTimer <= 0) {
            this.spawnBug()
            this.bugTimer = 300 + Math.random() * 220
        }
    }

    private fireStaple(b: Boss) {
        // Low staples must be jumped; later volleys mix in high ones that punish jumping at the wrong time.
        const high = b.hp <= 3 && b.burst % 2 === 0
        const floor = 13 * TILE
        this.staples.push({
            x: b.dir === 1 ? b.x + b.w + 2 : b.x - 8,
            y: high ? floor - 30 : floor - 10,
            vx: b.dir * Math.min(4, 2.4 * (1 + (BOSS_HP - b.hp) * 0.12)),
            dead: false,
        })
        sound.play('staple')
    }

    private updateStaples() {
        const p = this.player
        this.staples.forEach((st) => {
            st.x += st.vx
            const col = Math.floor((st.x + 3) / TILE)
            const row = Math.floor((st.y + 1) / TILE)
            if (col <= 0 || col >= this.level.cols - 1 || isSolid(this.level.tiles[row]?.[col])) st.dead = true
            const box = { x: st.x, y: st.y, w: 6, h: 3, vx: 0, vy: 0, onGround: false }
            if (!st.dead && overlaps(p, box)) {
                st.dead = true
                this.hurt()
            }
        })
        this.staples = this.staples.filter((st) => !st.dead)
    }

    private spawnBug() {
        const fromLeft = Math.random() < 0.5
        this.enemies.push({
            kind: 'bug',
            x: fromLeft ? TILE + 2 : (this.level.cols - 2) * TILE + 2,
            y: 13 * TILE - 12,
            w: 12,
            h: 12,
            vx: 0,
            vy: 0,
            onGround: true,
            dir: fromLeft ? 1 : -1,
            speed: BUG_SPEED,
            crossing: true,
            mode: 'walk',
            timer: 0,
            active: true,
            dead: false,
        })
    }

    private touchBoss(prevBottom: number, jumpDown: boolean) {
        const b = this.boss
        const p = this.player
        if (!b || b.mode === 'defeated' || b.hurt > 0 || !overlaps(p, b)) return
        if (prevBottom > b.y + 6) {
            this.hurt()
            return
        }
        // Stomped on his head.
        b.hp--
        b.hurt = 90
        p.vy = jumpDown ? -7 : -5.5
        this.addScore(1000, b.x, b.y - 8)
        sound.play('bossHit')
        if (b.hp > 0) {
            this.say(this.pick(HIT_LINES), 120)
            return
        }
        b.mode = 'defeated'
        b.vy = -5
        b.timer = 0
        this.say(DEFEAT_LINE, 210)
        this.addScore(5000, b.x, b.y - 20)
        this.staples = []
        this.enemies = []
        music.stop()
        sound.play('flag')
    }

    // ---- Coffee and broken bricks -------------------------------------------

    private spawnCoffee(col: number, row: number) {
        this.items.push({
            x: col * TILE + 2,
            y: row * TILE,
            w: 12,
            h: 14,
            vx: 0,
            vy: 0,
            onGround: false,
            dir: 1,
            rising: 32,
            dead: false,
        })
        sound.play('sprout')
    }

    private updateItems() {
        const p = this.player
        this.items.forEach((item) => {
            if (item.rising > 0) {
                item.rising--
                item.y -= 0.5
                return
            }
            item.vx = item.dir * 1
            item.vy = Math.min(item.vy + PHYSICS.gravity, PHYSICS.maxFall)
            moveBody(item, this.level.tiles)
            if (item.vx === 0) item.dir = item.dir === 1 ? -1 : 1
            if (item.y > ROWS * TILE + 32) item.dead = true
            if (!item.dead && overlaps(p, item)) {
                item.dead = true
                this.addScore(1000, item.x, item.y - 8)
                sound.play('powerup')
                if (!this.big) {
                    this.setBig(true)
                    this.state = 'grow'
                    this.timer = 0
                }
            }
        })
        this.items = this.items.filter((item) => !item.dead)
    }

    private breakBrick(col: number, row: number) {
        this.level.tiles[row][col] = '.'
        const x = col * TILE
        const y = row * TILE
        ;[
            [-1.2, -5],
            [1.2, -5],
            [-1, -3.5],
            [1, -3.5],
        ].forEach(([vx, vy], i) => this.debris.push({ x: x + (i % 2) * 8, y: y + (i < 2 ? 0 : 8), vx, vy, frame: 0 }))
        this.score += 50
        sound.play('break')
    }

    // Items and enemies standing on a block that gets bumped from below are knocked up.
    private popItemsOn(col: number, row: number) {
        this.items.forEach((item) => {
            const onTop = Math.abs(item.y + item.h - row * TILE) < 3
            const above = item.x + item.w > col * TILE && item.x < (col + 1) * TILE
            if (item.rising === 0 && onTop && above) item.vy = -4
        })
    }

    // Enemies standing on a block that gets bumped from below are knocked out.
    private knockEnemiesOn(col: number, row: number) {
        const top = row * TILE
        this.enemies.forEach((e) => {
            if (e.mode !== 'walk' || !e.active) return
            const onTop = Math.abs(e.y + e.h - top) < 3
            const above = e.x + e.w > col * TILE && e.x < (col + 1) * TILE
            if (!onTop || !above) return
            e.mode = 'knocked'
            e.vy = -3.5
            e.vx = e.x + e.w / 2 < (col + 0.5) * TILE ? -1 : 1
            this.addScore(100, e.x, e.y - 8)
            sound.play('stomp')
        })
    }

    // ---- Blocks and coins ---------------------------------------------------

    private indexProjects() {
        let index = 0
        this.level.tiles.forEach((row, r) =>
            row.forEach((tile, c) => {
                if (tile === 'P') this.projectIndexes[`${c},${r}`] = index++
            })
        )
    }

    private bumpTile(col: number, row: number) {
        const tiles = this.level.tiles
        const tile = tiles[row][col]
        const key = `${col},${row}`

        if ('B?MAaPp'.includes(tile)) {
            this.bumps.push({ col, row, frame: 0 })
            this.knockEnemiesOn(col, row)
            this.popItemsOn(col, row)
        }
        switch (tile) {
            case '?':
                tiles[row][col] = 'U'
                this.addCoin(col, row)
                break
            case 'M':
                tiles[row][col] = 'U'
                this.spawnCoffee(col, row)
                break
            case 'B':
                if (this.big) this.breakBrick(col, row)
                else sound.play('bump')
                break
            case 'A':
                tiles[row][col] = 'a'
                this.addCoin(col, row)
                this.openSection('about', undefined, 'play')
                break
            case 'a':
                this.openSection('about', undefined, 'play')
                break
            case 'P':
                tiles[row][col] = 'p'
                this.addCoin(col, row)
                this.openSection('project', this.projectIndexes[key], 'play')
                break
            case 'p':
                this.openSection('project', this.projectIndexes[key], 'play')
                break
            default:
                sound.play('bump')
        }
    }

    private addCoin(col: number, row: number) {
        this.coins++
        this.score += 200
        this.coinPops.push({ x: col * TILE, y: (row - 1) * TILE, vy: -4, frame: 0 })
        sound.play('coin')
    }

    private collectCoins() {
        overlappingTiles(this.player, this.level.cols).forEach(({ col, row }) => {
            if (this.level.tiles[row][col] === 'o') {
                this.level.tiles[row][col] = '.'
                this.coins++
                this.score += 200
                sound.play('coin')
            }
        })
    }

    private isOnWorkPipe() {
        const p = this.player
        const row = Math.floor((p.y + p.h) / TILE)
        const tiles = this.level.tiles[row]
        if (!tiles) return false
        const centre = p.x + p.w / 2
        const col = Math.floor(centre / TILE)
        const pipeCol = tiles[col] === 'W' ? col : tiles[col - 1] === 'W' ? col - 1 : -1
        if (pipeCol < 0) return false
        // Require the player to be roughly centred on the pipe.
        return centre > pipeCol * TILE + 6 && centre < pipeCol * TILE + 2 * TILE - 6
    }

    private updateEffects() {
        this.bumps = this.bumps.filter((b) => ++b.frame < 10)
        this.coinPops = this.coinPops.filter((c) => {
            c.y += c.vy
            c.vy += 0.25
            return ++c.frame < 32
        })
        this.popups = this.popups.filter((popup) => {
            popup.y -= 0.6
            return ++popup.frame < 50
        })
        this.debris = this.debris.filter((d) => {
            d.x += d.vx
            d.y += d.vy
            d.vy += 0.3
            return ++d.frame < 90
        })
    }

    // ---- Camera -------------------------------------------------------------

    private updateCamera(snap: boolean) {
        const levelWidth = this.level.cols * TILE
        // A room narrower than the screen (the boss office) sits in the middle.
        if (levelWidth <= this.viewWidth) {
            this.camX = (levelWidth - this.viewWidth) / 2
            return
        }
        const target = this.player.x - this.viewWidth * 0.4
        const max = Math.max(0, levelWidth - this.viewWidth)
        const clamped = Math.max(0, Math.min(max, target))
        this.camX = snap ? clamped : this.camX + (clamped - this.camX) * 0.2
    }

    // ---- Drawing ------------------------------------------------------------

    private makeStars() {
        this.stars = []
        let s = 42
        for (let i = 0; i < this.level.cols * 0.6; i++) {
            s = (s * 9301 + 49297) % 233280
            const x = s % (this.level.cols * TILE)
            s = (s * 9301 + 49297) % 233280
            // Spread stars into the extra sky that tall screens show above the level.
            const y = (s % (15 * TILE)) - 6 * TILE
            this.stars.push({ x, y })
        }
    }

    private visibleCols(camX: number) {
        const first = Math.max(0, Math.floor(camX / TILE))
        const last = Math.min(this.level.cols - 1, Math.ceil((camX + this.viewWidth) / TILE))
        return { first, last }
    }

    private draw() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const scale = this.scale
        // Snap the camera to whole screen pixels so tiles don't shimmer.
        const camX = Math.round(this.camX * scale) / scale

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.imageSmoothingEnabled = false
        const sky = ctx.createLinearGradient(0, 0, 0, this.canvas.height)
        sky.addColorStop(0, p.skyTop)
        sky.addColorStop(1, p.skyBottom)
        ctx.fillStyle = sky
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        const offsetY = Math.round(this.offsetY * scale)

        // Far-away layers scroll slower than the level, for depth.
        ctx.setTransform(scale, 0, 0, scale, 0, offsetY)
        if (this.level.mode === 'boss') {
            this.drawOffice(camX)
        } else if (this.theme === 'dark') {
            ctx.fillStyle = p.star
            this.stars.forEach((star) => {
                const x = (((star.x - camX * 0.1) % this.viewWidth) + this.viewWidth) % this.viewWidth
                const twinkle = (star.x + this.frame) % 90 < 6
                ctx.fillRect(x, star.y, twinkle ? 2 : 1, twinkle ? 2 : 1)
            })
            this.drawMoon()
        }
        if (this.level.mode !== 'boss') {
            this.drawMountains(camX)
            this.drawClouds(camX)
            this.drawFarHills(camX)
        }

        ctx.setTransform(scale, 0, 0, scale, -camX * scale, offsetY)
        this.level.decor.forEach((d) => this.drawDecor(d))
        this.drawCastle()
        this.drawLabels()
        this.drawCheckpoint()

        const behindPipe = this.state === 'pipeDown' || this.state === 'pipeUp'
        if (behindPipe) this.drawPlayer()
        // Coffee rising out of a block is drawn behind it.
        this.drawItems(true)
        this.drawTiles(camX)
        this.drawOutside(camX)
        this.drawBelowLevel(camX)
        this.drawFlag()
        this.drawItems(false)
        this.drawBoss()
        this.drawEnemies()
        this.drawStaples()
        this.drawCoinPops()
        this.drawDebris()
        if (!behindPipe) this.drawPlayer()
        this.drawPopups()
        this.drawSpeech(camX)

        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        if (this.state === 'intro') this.drawIntro()
        else this.drawHud()
    }

    private drawTiles(camX: number) {
        const ctx = this.ctx
        const s = this.sprites
        const tiles = this.level.tiles
        const { first, last } = this.visibleCols(camX)
        const coinWidth = Math.abs(Math.cos(this.frame / 12))

        for (let row = 0; row < ROWS; row++) {
            for (let col = first; col <= last; col++) {
                const tile = tiles[row][col]
                if (tile === '.') continue
                const bump = this.bumps.find((b) => b.col === col && b.row === row)
                const x = col * TILE
                const y = row * TILE - (bump ? Math.sin((bump.frame / 10) * Math.PI) * 5 : 0)

                let sprite: HTMLCanvasElement | null = null
                switch (tile) {
                    case '#': {
                        const top = !(row > 0 && tiles[row - 1][col] === '#')
                        if (this.level.mode === 'boss') sprite = top ? s.officeFloorTop : s.officeFloor
                        else sprite = top ? s.groundTop : s.ground
                        break
                    }
                    case 'B':
                        sprite = s.brick
                        break
                    case 'X':
                        sprite = s.hard
                        break
                    case '?':
                    case 'M':
                    case 'A':
                    case 'P':
                        sprite = s.block
                        break
                    case 'U':
                    case 'a':
                    case 'p':
                        sprite = s.used
                        break
                    case '[':
                    case 'W':
                        sprite = s.pipe.topL
                        break
                    case ']':
                        sprite = s.pipe.topR
                        break
                    case '{':
                        sprite = s.pipe.bodyL
                        break
                    case '}':
                        sprite = s.pipe.bodyR
                        break
                    case 'o': {
                        const w = Math.max(2, TILE * coinWidth)
                        ctx.drawImage(s.coin, x + (TILE - w) / 2, y, w, TILE)
                        break
                    }
                }
                if (sprite) ctx.drawImage(sprite, x, y)
                // Unopened blocks pulse gently so they read as "hit me".
                if (tile === '?' || tile === 'M' || tile === 'A' || tile === 'P') {
                    const glow = (Math.sin(this.frame / 10) + 1) / 2
                    ctx.fillStyle = `rgba(255,255,255,${glow * 0.25})`
                    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2)
                }
            }
        }
    }

    // Tall touch screens show space below the level for the buttons: continue the ground there.
    private drawBelowLevel(camX: number) {
        const depth = this.canvas.height / this.scale - this.offsetY - ROWS * TILE
        if (depth <= 0) return
        this.ctx.fillStyle = this.sprites.palette.ground
        const { first, last } = this.visibleCols(camX)
        for (let col = first; col <= last; col++) {
            if (this.level.tiles[ROWS - 1][col] === '#') {
                this.ctx.fillRect(col * TILE, ROWS * TILE, TILE, depth + 1)
            }
        }
    }

    private drawPlayer() {
        if (this.hidden) return
        // Flash while invincible after shrinking.
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return
        const p = this.player
        // While growing, flicker between small and tall.
        const showBig = this.state === 'grow' ? Math.floor(this.timer / 6) % 2 === 1 : this.big
        const frames = showBig ? this.sprites.bigPlayer : this.sprites.player
        let frame: keyof typeof frames = 'stand'
        if (this.state === 'flagSlide' || this.state === 'dying') frame = 'jump'
        else if (!p.onGround && this.state === 'play') frame = 'jump'
        else if (p.vx !== 0) frame = Math.floor(this.walkFrame) % 2 === 0 ? 'walk1' : 'walk2'
        const sprite = frames[frame][this.facing]
        this.ctx.drawImage(sprite, Math.round(p.x - 2), Math.round(p.y + p.h - sprite.height))
    }

    private drawItems(rising: boolean) {
        this.items.forEach((item) => {
            if ((item.rising > 0) !== rising) return
            this.ctx.drawImage(this.sprites.coffee, Math.round(item.x - 2), Math.round(item.y + item.h - TILE))
        })
    }

    private drawDebris() {
        const brick = this.sprites.palette.brick
        this.debris.forEach((d) => {
            const x = Math.round(d.x)
            const y = Math.round(d.y)
            this.ctx.fillStyle = shade(brick, -0.6)
            this.ctx.fillRect(x - 1, y - 1, 8, 8)
            this.ctx.fillStyle = brick
            this.ctx.fillRect(x, y, 6, 6)
            this.ctx.fillStyle = shade(brick, 0.4)
            this.ctx.fillRect(x, y, 6, 1)
        })
    }

    // A pixel-art filled ellipse.
    private ellipse(cx: number, cy: number, rx: number, ry: number, color: string) {
        const ctx = this.ctx
        ctx.fillStyle = color
        for (let dy = -ry; dy <= ry; dy++) {
            const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)))
            ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1.5)
        }
    }

    private drawMoon() {
        const p = this.sprites.palette
        const x = this.viewWidth * 0.78
        const y = 38
        ;[26, 20].forEach((r, i) => this.ellipse(x, y, r, r, `rgba(255,244,192,${0.05 + i * 0.05})`))
        this.ellipse(x, y, 13, 13, p.moon)
        this.ellipse(x + 3, y + 3, 10, 10, shade(p.moon, -0.08))
        this.ellipse(x - 2, y - 2, 11, 11, p.moon)
        ;[
            [-4, -3, 3],
            [4, 2, 2],
            [-1, 5, 2],
        ].forEach(([dx, dy, r]) => this.ellipse(x + dx, y + dy, r, r, shade(p.moon, -0.15)))
    }

    // Distant mountains with snowy peaks, scrolling at a fifth of the level's speed.
    private drawMountains(camX: number) {
        const ctx = this.ctx
        const p = this.sprites.palette
        const base = 13 * TILE
        const height = (wx: number) => 62 + 24 * Math.sin(wx * 0.011) + 16 * Math.sin(wx * 0.029 + 2) + 7 * Math.sin(wx * 0.07 + 1)
        for (let sx = 0; sx < this.viewWidth + 2; sx += 2) {
            const wx = sx + camX * 0.2
            const h = height(wx)
            // Compare with a point a little to the left, so the lit side changes smoothly.
            const rising = h > height(wx - 8)
            const top = Math.round(base - h)
            ctx.fillStyle = shade(p.mountain, rising ? 0.12 : -0.08)
            // 3px wide on a 2px step: the overlap hides seams when the screen scale isn't a whole number.
            ctx.fillRect(sx, top, 3, base - top)
            if (h > 82) {
                ctx.fillStyle = shade(p.mountainSnow, rising ? 0 : -0.15)
                ctx.fillRect(sx, top, 3, Math.min(8, h - 82 + 2))
            }
        }
    }

    // Rolling hills between the mountains and the level, at half speed.
    private drawFarHills(camX: number) {
        const ctx = this.ctx
        const p = this.sprites.palette
        const base = 13 * TILE
        for (let sx = 0; sx < this.viewWidth + 2; sx += 2) {
            const wx = sx + camX * 0.45
            const h = 30 + 12 * Math.sin(wx * 0.021) + 7 * Math.sin(wx * 0.053 + 3)
            const top = Math.round(base - h)
            ctx.fillStyle = p.farHill
            ctx.fillRect(sx, top, 3, base - top)
            ctx.fillStyle = shade(p.farHill, 0.2)
            ctx.fillRect(sx, top, 3, 2)
        }
    }

    // Puffy clouds that drift slowly and scroll at a third of the level's speed.
    private drawClouds(camX: number) {
        const p = this.sprites.palette
        const spacing = 150
        const shift = camX * 0.3 + this.frame * 0.05
        const first = Math.floor(shift / spacing) - 1
        for (let k = first; k < first + this.viewWidth / spacing + 3; k++) {
            const hash = (n: number) => {
                const v = Math.sin(k * 127.1 + n * 311.7) * 43758.5453
                return v - Math.floor(v)
            }
            const x = k * spacing + hash(1) * 60 - shift
            const y = 24 + hash(2) * 46
            const puffs = 2 + Math.floor(hash(3) * 3)
            const draw = (color: string, grow: number, dy: number) => {
                for (let i = 0; i < puffs; i++) {
                    const r = i === 0 || i === puffs - 1 ? 8 : 11
                    this.ellipse(x + i * 12, y - (r - 8) + dy, r + grow, r * 0.8 + grow, color)
                }
                this.ellipse(x + ((puffs - 1) * 12) / 2, y + 3 + dy, (puffs - 1) * 6 + 8 + grow, 6 + grow, color)
            }
            draw(shade(p.cloudShade, -0.2), 1, 0)
            draw(p.cloudShade, 0, 0)
            draw(p.cloud, -1, -2)
        }
    }

    private drawEnemies() {
        const ctx = this.ctx
        const step = Math.floor(this.frame / 10) % 2
        this.enemies.forEach((e) => {
            if (!e.active) return
            let sprite: HTMLCanvasElement
            if (e.kind === 'shredder') sprite = this.sprites.shredder[e.dir === 1 ? 'right' : 'left'][step]
            else sprite = e.mode === 'flat' ? this.sprites.bug.flat : this.sprites.bug.walk[step]
            const x = Math.round(e.x - 2)
            const y = Math.round(e.y + e.h - TILE)
            if (e.mode === 'knocked') {
                // Upside down as it falls away.
                ctx.save()
                ctx.translate(x, y + TILE)
                ctx.scale(1, -1)
                ctx.drawImage(sprite, 0, 0)
                ctx.restore()
            } else {
                ctx.drawImage(sprite, x, y)
            }
        })
    }

    private drawBoss() {
        const b = this.boss
        if (!b) return
        // Flash after being stomped.
        if (b.hurt > 0 && Math.floor(b.hurt / 4) % 2 === 0) return
        const ctx = this.ctx
        const facing = b.dir === 1 ? 'right' : 'left'
        const walking = b.vx !== 0 && b.onGround && Math.floor(this.frame / 8) % 2 === 1
        const frame = b.mode === 'aim' ? 'aim' : walking ? 'walk' : 'stand'
        const sprite = this.sprites.boss[frame][facing]
        const x = Math.round(b.x - 3)
        const y = Math.round(b.y + b.h - sprite.height)
        if (b.mode === 'defeated') {
            ctx.save()
            ctx.translate(x, y + sprite.height)
            ctx.scale(1, -1)
            ctx.drawImage(sprite, 0, 0)
            ctx.restore()
            return
        }
        ctx.drawImage(sprite, x, y)
        if (b.mode === 'aim') {
            ctx.drawImage(this.sprites.stapler[facing], facing === 'right' ? x + 20 : x - 8, y + 19)
        }
    }

    private drawStaples() {
        const ctx = this.ctx
        this.staples.forEach((st) => {
            const x = Math.round(st.x)
            const y = Math.round(st.y)
            ctx.fillStyle = '#1a1a22'
            ctx.fillRect(x - 1, y - 1, 8, 5)
            ctx.fillStyle = '#d8d8e8'
            ctx.fillRect(x, y, 6, 1)
            ctx.fillRect(x, y, 1, 3)
            ctx.fillRect(x + 5, y, 1, 3)
        })
    }

    // The Manager's speech bubble.
    private drawSpeech(camX: number) {
        const b = this.boss
        if (!b || b.tauntFrames <= 0) return
        const ctx = this.ctx
        ctx.font = 'bold 7px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        // Wrap the words to fit a small bubble.
        const lines: string[] = []
        b.taunt.split(' ').forEach((word) => {
            const last = lines[lines.length - 1]
            if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= 110) lines[lines.length - 1] = `${last} ${word}`
            else lines.push(word)
        })
        const width = Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line).width))) + 10
        const height = lines.length * 9 + 6
        const headX = b.x + b.w / 2
        const bx = Math.round(Math.max(camX + 4, Math.min(camX + this.viewWidth - width - 4, headX - width / 2)))
        const by = Math.round(b.y - height - 12)
        ctx.fillStyle = '#101010'
        ctx.fillRect(bx - 1, by - 1, width + 2, height + 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(bx, by, width, height)
        // Tail pointing at his head.
        const tailX = Math.round(Math.max(bx + 4, Math.min(bx + width - 8, headX - 2)))
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = '#101010'
            ctx.fillRect(tailX - 1 + i / 2, by + height + i, 6 - i + 2, 1)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(tailX + i / 2, by + height + i - 1, 6 - i, 1)
        }
        ctx.fillStyle = '#101010'
        lines.forEach((line, i) => ctx.fillText(line, bx + 5, by + 4 + i * 9))
    }

    // When the room is narrower than the screen, fill the space beyond its walls with more wall.
    private drawOutside(camX: number) {
        const cols = this.level.cols
        const first = Math.floor(camX / TILE)
        const last = Math.ceil((camX + this.viewWidth) / TILE)
        for (let col = first; col <= last; col++) {
            if (col >= 0 && col < cols) continue
            for (let row = 0; row < ROWS; row++) this.ctx.drawImage(this.sprites.hard, col * TILE, row * TILE)
        }
    }

    // The Manager's office: a wall with windows onto the city, posters and a clock.
    private drawOffice(camX: number) {
        const ctx = this.ctx
        const dark = this.theme === 'dark'
        const width = this.viewWidth
        const top = -this.offsetY - 1
        const floor = 13 * TILE
        const wall = dark ? '#2e3040' : '#e2d8c0'
        ctx.fillStyle = wall
        ctx.fillRect(0, top, width, floor - top)
        // Wainscoting along the bottom of the wall.
        ctx.fillStyle = shade(wall, -0.15)
        ctx.fillRect(0, floor - 40, width, 40)
        ctx.fillStyle = shade(wall, 0.25)
        ctx.fillRect(0, floor - 41, width, 1)
        ctx.fillStyle = shade(wall, -0.35)
        ctx.fillRect(0, floor - 40, width, 1)

        const spacing = 128
        const shift = camX * 0.5
        const firstWindow = Math.floor(shift / spacing) - 1
        for (let k = firstWindow; k < firstWindow + width / spacing + 3; k++) {
            const x = Math.round(k * spacing - shift)
            const hash = (n: number) => {
                const v = Math.sin(k * 91.7 + n * 47.3) * 43758.5453
                return v - Math.floor(v)
            }
            // Window frame and glass.
            ctx.fillStyle = shade(wall, -0.45)
            ctx.fillRect(x - 3, 21, 70, 80)
            const glass = ctx.createLinearGradient(0, 24, 0, 98)
            glass.addColorStop(0, dark ? '#070a22' : '#5a9af0')
            glass.addColorStop(1, dark ? '#243060' : '#c8e4ff')
            ctx.fillStyle = glass
            ctx.fillRect(x, 24, 64, 74)
            // City skyline, with lit windows at night.
            for (let i = 0; i < 8; i++) {
                const h = 16 + Math.floor(hash(i) * 40)
                ctx.fillStyle = dark ? '#141a30' : '#8aa0c0'
                ctx.fillRect(x + i * 8, 98 - h, 8, h)
                if (!dark) continue
                ctx.fillStyle = '#ffd860'
                for (let wy = 98 - h + 3; wy < 96; wy += 5) {
                    for (let wx = 1; wx < 7; wx += 3) {
                        if (hash(i * 13 + wy + wx) > 0.55) ctx.fillRect(x + i * 8 + wx, wy, 1, 2)
                    }
                }
            }
            ctx.fillStyle = shade(wall, -0.45)
            ctx.fillRect(x + 31, 24, 2, 74)
            ctx.fillRect(x, 60, 64, 2)
            ctx.fillStyle = shade(wall, 0.3)
            ctx.fillRect(x - 3, 101, 70, 2)

            if (k % 2 === 0) {
                // A motivational poster.
                const px = x + 80
                ctx.fillStyle = '#1a1a1a'
                ctx.fillRect(px, 40, 32, 40)
                ctx.fillStyle = dark ? '#2a3a6a' : '#3a6ad0'
                ctx.fillRect(px + 2, 42, 28, 26)
                ctx.fillStyle = dark ? '#8a94c8' : '#ffffff'
                for (let i = 0; i < 10; i++) ctx.fillRect(px + 16 - i, 52 + i, i * 2, 1)
                ctx.fillStyle = '#ffffff'
                ctx.font = 'bold 5px sans-serif'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText('SYNERGY', px + 16, 74)
            } else {
                // A wall clock.
                const cx = x + 96
                this.ellipse(cx, 72, 10, 10, '#1a1a1a')
                this.ellipse(cx, 72, 8, 8, dark ? '#c8c8d0' : '#ffffff')
                ctx.fillStyle = '#1a1a1a'
                ctx.fillRect(cx, 66, 1, 6)
                ctx.fillRect(cx, 72, 4, 1)
            }
        }
    }

    private drawCheckpoint() {
        const { checkpointCol } = this.level
        if (checkpointCol === undefined) return
        const ctx = this.ctx
        const p = this.sprites.palette
        const x = checkpointCol * TILE + 7
        ctx.fillStyle = shade(p.hard, -0.5)
        ctx.fillRect(x, 10 * TILE, 2, 3 * TILE)
        // Grey until reached, then gold.
        ctx.fillStyle = this.checkpointReached ? p.block : '#9a9a9a'
        for (let i = 0; i < 9; i++) ctx.fillRect(x + 2, 10 * TILE + i, 10 - Math.abs(4 - i) * 2, 1)
    }

    private drawPopups() {
        const ctx = this.ctx
        const p = this.sprites.palette
        ctx.font = '7px SuperMario256, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        this.popups.forEach((popup) => {
            ctx.fillStyle = p.labelShadow
            ctx.fillText(popup.text, popup.x + 9, popup.y + 1)
            ctx.fillStyle = p.label
            ctx.fillText(popup.text, popup.x + 8, popup.y)
        })
    }

    private drawCoinPops() {
        const w = Math.abs(Math.cos(this.frame / 3)) * TILE
        this.coinPops.forEach((c) => {
            this.ctx.drawImage(this.sprites.coin, c.x + (TILE - Math.max(2, w)) / 2, c.y, Math.max(2, w), TILE)
        })
    }

    private drawFlag() {
        if (this.level.flagCol === undefined) return
        const ctx = this.ctx
        const p = this.sprites.palette
        const poleX = this.level.flagCol * TILE + 7
        const top = 2 * TILE
        ctx.fillStyle = shade(p.pipe, 0.5)
        ctx.fillRect(poleX, top, 1, 12 * TILE - top)
        ctx.fillStyle = shade(p.pipe, 0.1)
        ctx.fillRect(poleX + 1, top, 1, 12 * TILE - top)
        // Ball on top.
        this.ellipse(poleX + 1, top - 3, 4, 4, shade(p.pipe, -0.5))
        this.ellipse(poleX + 1, top - 3, 3, 3, p.pipe)
        ctx.fillStyle = shade(p.pipe, 0.6)
        ctx.fillRect(poleX, top - 5, 1, 1)
        // The flag: a white pennant with a star.
        ctx.fillStyle = '#ffffff'
        for (let i = 0; i < 12; i++) {
            const len = 14 - Math.abs(6 - i) * 2
            ctx.fillRect(poleX - len, this.flagY + i, len, 1)
        }
        ctx.fillStyle = p.block
        ctx.fillRect(poleX - 8, this.flagY + 4, 4, 4)
    }

    private drawCastle() {
        if (this.level.castleCol === undefined) return
        const ctx = this.ctx
        const p = this.sprites.palette
        const x = this.level.castleCol * TILE
        const ground = 13 * TILE
        const brick = (bx: number, by: number, w: number, h: number) => {
            ctx.fillStyle = p.castle
            ctx.fillRect(bx, by, w, h)
            // Brick highlights, then mortar lines.
            ctx.fillStyle = shade(p.castle, 0.3)
            for (let y = by; y < by + h; y += 4) ctx.fillRect(bx, y, w, 1)
            ctx.fillStyle = shade(p.castle, -0.25)
            ctx.fillRect(bx + w - 2, by, 2, h)
            ctx.fillStyle = p.castleDark
            for (let y = by + 3; y < by + h; y += 4) ctx.fillRect(bx, y, w, 1)
            for (let y = by; y < by + h; y += 4) {
                const offset = (y / 4) % 2 === 0 ? 0 : 4
                for (let xx = bx + offset; xx < bx + w; xx += 8) ctx.fillRect(xx, y, 1, 3)
            }
        }
        // Lower wall, battlements, tower.
        brick(x, ground - 3 * TILE, 5 * TILE, 3 * TILE)
        for (let i = 0; i < 5; i++) brick(x + i * TILE + 2, ground - 3 * TILE - 8, 12, 8)
        brick(x + TILE, ground - 5 * TILE, 3 * TILE, 2 * TILE - 8)
        for (let i = 0; i < 3; i++) brick(x + TILE + i * TILE + 2, ground - 5 * TILE - 8, 12, 8)
        // Door and window.
        ctx.fillStyle = '#000000'
        ctx.fillRect(x + 2 * TILE, ground - 2 * TILE, TILE, 2 * TILE)
        ctx.fillRect(x + 2 * TILE + 2, ground - 2 * TILE - 4, TILE - 4, 4)
        ctx.fillRect(x + 2 * TILE + 4, ground - 4 * TILE - 4, TILE - 8, 12)
    }

    private drawDecor(d: Decor) {
        const ctx = this.ctx
        const p = this.sprites.palette
        const x = d.col * TILE
        const y = d.row * TILE
        if (d.kind === 'hill') {
            // A rounded mound, `size` tiles tall: outlined, lit from the upper left.
            const height = d.size * TILE
            const cx = x + height * 1.2
            const halfAt = (i: number) => Math.round(Math.sqrt(1 - Math.pow(1 - i / height, 2)) * height * 1.2)
            // Three passes (outline, body, highlight) so overlapping rows never leave dark lines.
            for (let i = 0; i < height; i++) {
                ctx.fillStyle = shade(p.hill, -0.55)
                ctx.fillRect(cx - halfAt(i) - 1, y - height + i, halfAt(i) * 2 + 2, 1.5)
            }
            for (let i = 0; i < height; i++) {
                ctx.fillStyle = shade(p.hill, -0.1 - (i / height) * 0.15)
                ctx.fillRect(cx - halfAt(i), y - height + i, halfAt(i) * 2, 1.5)
            }
            ctx.fillStyle = shade(p.hill, 0.25)
            for (let i = 0; i < height; i++) {
                ctx.fillRect(cx - halfAt(i), y - height + i, Math.max(1, Math.round(halfAt(i) * 0.35)), 1.5)
            }
            ctx.fillStyle = shade(p.hill, -0.55)
            ctx.fillRect(cx - 4, y - height, 8, 1)
            ctx.fillStyle = shade(p.hill, -0.35)
            ctx.fillRect(cx - 3, y - height + 8, 2, 4)
            ctx.fillRect(cx + 4, y - height + 12, 2, 4)
        } else {
            // Bushes: a row of puffs, outlined and shaded.
            const draw = (color: string, grow: number, dy: number) => {
                for (let i = 0; i <= d.size; i++) this.ellipse(x + 8 + i * TILE, y - 8 + dy, 8 + grow, 7 + grow, color)
                ctx.fillStyle = color
                ctx.fillRect(x + 2 - grow, y - 6 + dy, d.size * TILE + 12 + grow * 2, 6)
            }
            draw(shade(p.bush, -0.6), 1, 0)
            draw(shade(p.bush, -0.15), 0, 0)
            draw(p.bush, -2, -2)
            ctx.fillStyle = shade(p.bush, 0.35)
            for (let i = 0; i <= d.size; i++) ctx.fillRect(x + 4 + i * TILE, y - 13, 4, 2)
        }
    }

    private drawLabels() {
        const ctx = this.ctx
        const p = this.sprites.palette
        ctx.font = '10px SuperMario256, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        this.level.labels.forEach((label) => {
            const x = label.col * TILE
            const bob = Math.sin(this.frame / 20 + label.col) * 1.5
            const y = label.row * TILE + bob
            ctx.fillStyle = p.labelShadow
            ctx.fillText(label.text, x + 1, y + 1)
            ctx.fillStyle = p.label
            ctx.fillText(label.text, x, y)
            if (label.arrow) {
                // A little down arrow pointing at the pipe.
                const ay = y + 10
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = p.labelShadow
                    ctx.fillRect(x - 5 + i + 1, ay + i + 1, 10 - i * 2, 1)
                    ctx.fillStyle = p.label
                    ctx.fillRect(x - 5 + i, ay + i, 10 - i * 2, 1)
                }
            }
        })
    }

    // The black "WORLD 1-2" card shown before each life.
    private drawIntro() {
        const ctx = this.ctx
        const width = this.viewWidth
        const height = this.canvas.height / this.scale
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
        ctx.font = '12px SuperMario256, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(`WORLD ${this.level.name}`, width / 2, height / 2 - 20)
        if (this.boss) {
            ctx.font = '9px SuperMario256, monospace'
            ctx.fillStyle = '#ff5050'
            ctx.fillText('BOSS FIGHT: THE MANAGER', width / 2, height / 2 - 6)
            ctx.fillStyle = '#ffffff'
        }
        const livesY = this.boss ? height / 2 + 10 : height / 2 - 2
        ctx.drawImage(this.sprites.player.stand.right, width / 2 - 26, livesY)
        ctx.font = '10px SuperMario256, monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`x  ${this.lives}`, width / 2 - 4, livesY + 8)
    }

    private drawHud() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const w = this.viewWidth
        const coins = String(this.coins).padStart(2, '0')
        ctx.font = '9px SuperMario256, monospace'
        ctx.textBaseline = 'top'
        const text = (value: string, x: number, y: number, align: CanvasTextAlign) => {
            ctx.textAlign = align
            ctx.fillStyle = p.labelShadow
            ctx.fillText(value, x + 1, y + 1)
            ctx.fillStyle = p.label
            ctx.fillText(value, x, y)
        }

        if (this.level.mode !== 'site') {
            const middle = w * 0.36
            text('FRED', 12, 8, 'left')
            text(String(this.score).padStart(6, '0'), 12, 19, 'left')
            ctx.drawImage(this.sprites.coin, middle - 12, 8, 8, 8)
            text(`x ${coins}`, middle, 8, 'left')
            ctx.drawImage(this.sprites.player.stand.right, middle - 14, 17, 10, 10)
            text(`x ${this.lives}`, middle, 19, 'left')
            text('WORLD', w * 0.68, 8, 'center')
            text(this.level.name, w * 0.68, 19, 'center')
            text('TIME', w - 12, 8, 'right')
            text(String(Math.max(0, this.time)), w - 12, 19, 'right')
            if (this.boss) {
                // The Manager's health bar.
                text('MANAGER', w / 2, 34, 'center')
                for (let i = 0; i < BOSS_HP; i++) {
                    const x = w / 2 - (BOSS_HP * 10) / 2 + i * 10
                    ctx.fillStyle = '#000000'
                    ctx.fillRect(x, 45, 9, 6)
                    ctx.fillStyle = i < this.boss.hp ? '#e02020' : '#444444'
                    ctx.fillRect(x + 1, 46, 7, 4)
                }
            }
            return
        }

        text('FRED', 12, 8, 'left')
        ctx.drawImage(this.sprites.coin, 12, 19, 8, 8)
        text(`x ${coins}`, 22, 19, 'left')
        text('WORLD', w - 12, 8, 'right')
        text(this.level.name, w - 12, 19, 'right')

        if (this.state === 'play' && !this.hasMoved) {
            const lines = this.touchMode
                ? ['HIT THE BLOCKS!', 'DOWN ENTERS PIPES']
                : ['ARROWS OR A/D TO MOVE   SPACE TO JUMP', 'HIT THE BLOCKS  -  DOWN TO ENTER PIPES']
            lines.forEach((line, i) => text(line, w / 2, 40 + i * 12, 'center'))
        }
    }
}
