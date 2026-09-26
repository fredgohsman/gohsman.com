/*
 * Background music: two original chiptune loops played live with the Web Audio API.
 *
 *   day   - "Overworld Stroll": bright and bouncy, C major, square-wave lead.
 *   night - "Starlit Walk": slower and dreamy, A minor, soft triangle lead with an echo.
 *
 * Songs are written one step (an eighth note) per token:
 *   C5  play a note     -  hold the previous note     .  rest
 * Drum tokens: k kick, s snare, h hi-hat, . rest.
 */

import { getAudioContext, getNoiseBuffer, sound } from './sound'

export type Track = 'day' | 'night'

interface Voice {
    wave: OscillatorType
    volume: number
    notes: string
    // Plays the same line again this many steps later, quieter (an echo).
    echo?: number
}

interface Song {
    bpm: number
    voices: Voice[]
    drums: string
}

const SONGS: Record<Track, Song> = {
    day: {
        bpm: 144,
        voices: [
            {
                wave: 'square',
                volume: 0.045,
                notes: [
                    'G4 C5 E5 G5 - E5 C5 E5',
                    'A4 C5 E5 A5 - G5 E5 C5',
                    'F4 A4 C5 F5 - E5 D5 C5',
                    'D5 - B4 G4 - A4 B4 D5',
                    'E5 G5 C6 - B5 G5 E5 G5',
                    'A5 - G5 E5 C5 - E5 G5',
                    'F5 E5 D5 C5 A4 C5 F5 A5',
                    'G5 - D5 B4 G4 - . .',
                ].join(' '),
            },
            {
                wave: 'triangle',
                volume: 0.12,
                notes: [
                    'C3 . G3 . C3 . G3 .',
                    'A2 . E3 . A2 . E3 .',
                    'F2 . C3 . F2 . C3 .',
                    'G2 . D3 . G2 . D3 .',
                    'C3 . G3 . C3 . G3 .',
                    'A2 . E3 . A2 . E3 .',
                    'F2 . C3 . F2 . C3 .',
                    'G2 . D3 . G2 B2 D3 .',
                ].join(' '),
            },
        ],
        drums: 'k h s h k h s h '.repeat(8),
    },
    night: {
        bpm: 96,
        voices: [
            {
                wave: 'triangle',
                volume: 0.13,
                echo: 3,
                notes: [
                    'A4 . C5 E5 - . D5 C5',
                    'F4 . A4 C5 - . B4 A4',
                    'E4 . G4 C5 - . B4 G4',
                    'G#4 - B4 E5 - D5 C5 B4',
                    'A5 - E5 C5 - . E5 A5',
                    'C6 - A5 F5 - . A5 C6',
                    'D5 F5 A5 - G5 F5 E5 D5',
                    'E5 - . G#4 B4 - . .',
                ].join(' '),
            },
            {
                wave: 'sine',
                volume: 0.12,
                notes: [
                    'A2 - - - E3 - - -',
                    'F2 - - - C3 - - -',
                    'C3 - - - G2 - - -',
                    'E2 - - - B2 - - -',
                    'A2 - - - E3 - - -',
                    'F2 - - - C3 - - -',
                    'D3 - - - A2 - - -',
                    'E2 - - - E3 - - -',
                ].join(' '),
            },
        ],
        drums: 'k . . . h . . . '.repeat(8),
    },
}

interface NoteEvent {
    step: number
    length: number
    frequency: number
    voice: Voice
    volume: number
}

const NOTE_OFFSETS: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }

// 'A4' -> 440 Hz, 'C#5', 'Bb3' and so on.
export function frequencyOf(name: string): number {
    const match = /^([A-G])([#b]?)(\d)$/.exec(name)
    if (!match) throw new Error(`Bad note ${name}`)
    const [, letter, accidental, octave] = match
    const semitones = NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + (Number(octave) - 4) * 12
    return 440 * Math.pow(2, semitones / 12)
}

function parseVoice(voice: Voice): NoteEvent[] {
    const events: NoteEvent[] = []
    voice.notes
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token, step) => {
            if (token === '-') {
                const last = events[events.length - 1]
                if (last && last.step + last.length === step) last.length++
            } else if (token !== '.') {
                events.push({ step, length: 1, frequency: frequencyOf(token), voice, volume: voice.volume })
            }
        })
    if (voice.echo) {
        events.slice().forEach((e) => events.push({ ...e, step: e.step + voice.echo!, volume: e.volume * 0.35 }))
    }
    return events
}

const parsed: Record<Track, { events: NoteEvent[]; drums: string[]; steps: number }> = {
    day: parseSong(SONGS.day),
    night: parseSong(SONGS.night),
}

function parseSong(song: Song) {
    const events = song.voices.flatMap(parseVoice)
    const drums = song.drums.split(/\s+/).filter(Boolean)
    const steps = Math.max(drums.length, ...song.voices.map((v) => v.notes.split(/\s+/).filter(Boolean).length))
    return { events, drums, steps }
}

const LOOKAHEAD = 0.25 // seconds of music scheduled ahead of time
// Music sits a little under the sound effects.
const MUSIC_VOLUME = 0.7

let currentTrack: Track | null = null
let tempo = 1
let startTime = 0
let nextStep = 0
let timerId: number | undefined
let master: GainNode | null = null

function scheduleNote(ctx: AudioContext, out: AudioNode, e: NoteEvent, time: number, stepSeconds: number) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const end = time + e.length * stepSeconds * 0.92
    oscillator.type = e.voice.wave
    oscillator.frequency.setValueAtTime(e.frequency, time)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(e.volume, time + 0.01)
    gain.gain.setValueAtTime(e.volume, Math.max(time + 0.01, end - 0.05))
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(gain).connect(out)
    oscillator.start(time)
    oscillator.stop(end + 0.02)
}

function scheduleDrum(ctx: AudioContext, out: AudioNode, kind: string, time: number) {
    if (kind === 'k') {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.frequency.setValueAtTime(150, time)
        oscillator.frequency.exponentialRampToValueAtTime(40, time + 0.12)
        gain.gain.setValueAtTime(0.25, time)
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15)
        oscillator.connect(gain).connect(out)
        oscillator.start(time)
        oscillator.stop(time + 0.16)
        return
    }
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const length = kind === 's' ? 0.12 : 0.04
    source.buffer = getNoiseBuffer(ctx)
    filter.type = kind === 's' ? 'bandpass' : 'highpass'
    filter.frequency.value = kind === 's' ? 1800 : 7000
    gain.gain.setValueAtTime(kind === 's' ? 0.18 : 0.06, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length)
    source.connect(filter).connect(gain).connect(out)
    source.start(time)
    source.stop(time + length + 0.02)
}

function tick() {
    const ctx = getAudioContext()
    const out = master
    if (!ctx || !out || !currentTrack || ctx.state !== 'running') return
    const song = parsed[currentTrack]
    const stepSeconds = 60 / (SONGS[currentTrack].bpm * tempo) / 2
    const horizon = ctx.currentTime + LOOKAHEAD

    // If we fell behind (for example after the tab was busy), skip ahead instead of bunching notes up.
    if (startTime + nextStep * stepSeconds < ctx.currentTime - 0.1) {
        nextStep = Math.ceil((ctx.currentTime - startTime) / stepSeconds)
    }

    while (startTime + nextStep * stepSeconds < horizon) {
        const time = startTime + nextStep * stepSeconds
        const inLoop = nextStep % song.steps
        song.events.forEach((e) => {
            if (e.step % song.steps === inLoop) scheduleNote(ctx, out, e, time, stepSeconds)
        })
        const drum = song.drums[inLoop]
        if (drum && drum !== '.') scheduleDrum(ctx, out, drum, time)
        nextStep++
    }
}

function applyMute(muted: boolean) {
    const ctx = getAudioContext()
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, ctx.currentTime, 0.05)
}

function fadeOut(ctx: AudioContext) {
    const old = master
    if (!old) return
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
    window.setTimeout(() => old.disconnect(), 400)
    master = null
}

sound.subscribe(applyMute)

export const music = {
    // Starts a track from the top. `speed` above 1 plays it faster.
    play(track: Track, speed = 1) {
        const ctx = getAudioContext()
        if (!ctx) return
        // Fade out anything still ringing from the previous track, then start on a fresh output.
        fadeOut(ctx)
        master = ctx.createGain()
        master.connect(ctx.destination)
        applyMute(sound.isMuted())

        currentTrack = track
        tempo = speed
        startTime = ctx.currentTime + 0.05
        nextStep = 0
        if (timerId === undefined) timerId = window.setInterval(tick, 50)
        tick()
    },

    // Switches tune (day/night) without restarting the beat.
    switchTrack(track: Track) {
        if (!currentTrack || currentTrack === track) return
        const speed = tempo
        this.play(track, speed)
    },

    stop() {
        currentTrack = null
        if (timerId !== undefined) {
            window.clearInterval(timerId)
            timerId = undefined
        }
        const ctx = getAudioContext()
        if (ctx) fadeOut(ctx)
    },

    isPlaying: () => currentTrack !== null,
}

// How many steps each part of a song has; every part should match so the loop stays in sync.
export function partLengths(track: Track): number[] {
    const song = SONGS[track]
    const count = (text: string) => text.split(/\s+/).filter(Boolean).length
    return [...song.voices.map((v) => count(v.notes)), count(song.drums)]
}
