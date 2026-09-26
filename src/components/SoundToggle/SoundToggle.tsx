import { useEffect, useState } from 'react'
import { sound } from 'game/sound'
import './SoundToggle.css'

export const SoundToggle = () => {
    const [muted, setMuted] = useState(sound.isMuted())

    useEffect(() => sound.subscribe(setMuted), [])

    return (
        <button
            type="button"
            className="sound-toggle"
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            title={muted ? 'Sound off' : 'Sound on'}
            onClick={() => {
                sound.unlock()
                sound.setMuted(!muted)
            }}
        >
            <i className={muted ? 'la la-volume-mute' : 'la la-volume-up'} />
        </button>
    )
}
