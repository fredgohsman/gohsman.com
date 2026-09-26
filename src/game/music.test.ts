import { frequencyOf, partLengths } from './music'

test('note names turn into the right pitches', () => {
    expect(frequencyOf('A4')).toBeCloseTo(440)
    expect(frequencyOf('C5')).toBeCloseTo(523.25, 1)
    expect(frequencyOf('G#4')).toBeCloseTo(415.3, 1)
})

test.each(['day', 'night', 'bossDay', 'bossNight'] as const)('every part of the %s tune is the same length', (track) => {
    const lengths = partLengths(track)
    expect(new Set(lengths).size).toBe(1)
})
