import { PointerEvent } from 'react'
import { Control } from './engine'
import './touchControls.css'

interface IProps {
    onControl: (control: Control, down: boolean) => void
}

interface ButtonProps extends IProps {
    control: Control
    label: string
    className?: string
}

const TouchButton = ({ control, label, className, onControl }: ButtonProps) => {
    const press = (down: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault()
        // Keep the button held even if the finger slides off it.
        if (down) {
            try {
                event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
                // Not all pointers can be captured; the button still works without it.
            }
        }
        onControl(control, down)
    }
    return (
        <button
            type="button"
            className={`touch-button ${className ?? ''}`}
            aria-label={control}
            onPointerDown={press(true)}
            onPointerUp={press(false)}
            onPointerCancel={press(false)}
            onLostPointerCapture={() => onControl(control, false)}
            onContextMenu={(event) => event.preventDefault()}
        >
            {label}
        </button>
    )
}

// On-screen buttons for phones and tablets.
export const TouchControls = ({ onControl }: IProps) => (
    <div className="touch-controls" aria-hidden="true">
        <div className="touch-pad">
            <TouchButton control="left" label="◀" onControl={onControl} />
            <TouchButton control="down" label="▼" onControl={onControl} />
            <TouchButton control="right" label="▶" onControl={onControl} />
        </div>
        <TouchButton control="jump" label="A" className="touch-jump" onControl={onControl} />
    </div>
)
