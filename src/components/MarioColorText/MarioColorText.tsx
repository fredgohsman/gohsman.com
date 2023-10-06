import './MarioColorText.css'

interface IProps {
    text: string
}

export const MarioColorText = ({ text }: IProps) => {
    return (
        <div className="mario-color-text">
            {text.split('').map((letter, index) => {
                return (
                    <span key={index} className={`mario-color-text-${index % 5}`}>
                        {letter}
                    </span>
                )
            })}
        </div>
    )
}
