import './Content.css'

import { ReactNode } from 'react'
import './Content.css'

interface IProps {
    children: ReactNode
}

export const Content = ({ children }: IProps) => {
    return <div className="page-content">{children}</div>
}
