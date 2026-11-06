import { Link, useLocation } from 'react-router-dom'
import { siteContent } from 'content/siteContent'
import './Footer.css'

export const Footer = () => {
    const { pathname } = useLocation()
    return (
        <footer className="app-footer">
            <nav className="content">
                {siteContent.contact.links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                        {link.label}
                    </a>
                ))}
                {pathname === '/plain' ? <Link to="/?play=1">Play</Link> : <Link to="/plain">Plain view</Link>}
            </nav>
        </footer>
    )
}
