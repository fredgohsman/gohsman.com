/*
 * Chiptune-style sound effects generated in the browser with the Web Audio API.
 * No audio files: each effect is a few short square/triangle wave notes.
 */

export type SoundName = 'jump' | 'coin' | 'bump' | 'pipe' | 'flag' | 'open' | 'stomp' | 'die' | 'gameover'

const STORAGE_KEY = 'sound-muted'

type Listener = (muted: boolean) => void

let context: AudioContext | null = null
let listeners: Listener[] = []
let muted = readMuted()

function readMuted(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function getContext(): AudioContext | null {
    if (context) return context
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtor) return null
    context = new AudioCtor()
    return context
}

// Plays one note. Times are in seconds from now.
function tone(
    ctx: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.08,
    endFrequency?: number
) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const t0 = ctx.currentTime + start
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, t0)
    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, t0 + duration)
    }
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(t0)
    oscillator.stop(t0 + duration + 0.02)
}

const effects: Record<SoundName, (ctx: AudioContext) => void> = {
    jump: (ctx) => tone(ctx, 260, 0, 0.18, 'square', 0.06, 620),
    coin: (ctx) => {
        tone(ctx, 988, 0, 0.08)
        tone(ctx, 1319, 0.08, 0.35)
    },
    bump: (ctx) => tone(ctx, 140, 0, 0.1, 'triangle', 0.15, 90),
    pipe: (ctx) => {
        tone(ctx, 440, 0, 0.1)
        tone(ctx, 330, 0.12, 0.1)
        tone(ctx, 220, 0.24, 0.15)
    },
    flag: (ctx) => {
        tone(ctx, 1200, 0, 0.8, 'square', 0.05, 300)
        ;[523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, 0.9 + i * 0.12, 0.2))
    },
    stomp: (ctx) => tone(ctx, 500, 0, 0.12, 'square', 0.07, 120),
    die: (ctx) => {
        ;[494, 698, 698, 698, 659, 587, 523].forEach((f, i) => tone(ctx, f, 0.15 + i * 0.14, 0.12))
    },
    gameover: (ctx) => {
        ;[523, 392, 330, 440, 494, 440, 415, 466, 415, 392].forEach((f, i) => tone(ctx, f, i * 0.18, 0.16, 'triangle', 0.15))
    },
    open: (ctx) => {
        ;[523, 659, 784].forEach((f, i) => tone(ctx, f, i * 0.06, 0.12, 'square', 0.05))
    },
}

export const sound = {
    isMuted: () => muted,

    setMuted(value: boolean) {
        muted = value
        try {
            window.localStorage.setItem(STORAGE_KEY, String(value))
        } catch {
            // Storage can be unavailable (private mode); the setting just won't persist.
        }
        listeners.forEach((listener) => listener(muted))
    },

    subscribe(listener: Listener) {
        listeners = [...listeners, listener]
        return () => {
            listeners = listeners.filter((l) => l !== listener)
        }
    },

    // Browsers only allow audio after a user gesture, so call this from a click or key press.
    unlock() {
        const ctx = getContext()
        if (ctx && ctx.state === 'suspended') {
            ctx.resume()
        }
    },

    play(name: SoundName) {
        if (muted) return
        const ctx = getContext()
        if (!ctx || ctx.state !== 'running') return
        effects[name](ctx)
    },
}
