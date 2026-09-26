import { useEffect, useRef } from 'react'
import { Section } from 'game/level'
import { siteContent } from 'content/siteContent'
import { AboutSection, ContactSection, ProjectCard, WorkSection } from 'components/Sections/Sections'
import './InfoPanel.css'

interface IProps {
    section: Section
    projectIndex?: number
    projectsFound: number
    onClose: () => void
}

// The pop-up box the game opens when you hit a block, enter a pipe or reach the flag.
export const InfoPanel = ({ section, projectIndex, projectsFound, onClose }: IProps) => {
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Focus the box itself, not a button: the player may still be holding Space from a jump,
        // and releasing it on a focused button would close the panel straight away.
        panelRef.current?.focus()
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || (event.key === 'Enter' && event.target === panelRef.current)) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const { items } = siteContent.projects
    const project = projectIndex !== undefined ? items[projectIndex] : undefined

    return (
        <div className="info-panel-backdrop" onClick={onClose}>
            <div
                ref={panelRef}
                tabIndex={-1}
                className="info-panel"
                role="dialog"
                aria-modal="true"
                aria-label={section}
                onClick={(event) => event.stopPropagation()}
            >
                <button type="button" className="info-panel-close" onClick={onClose} aria-label="Close">
                    ✕
                </button>
                {section === 'about' && <AboutSection />}
                {section === 'work' && <WorkSection />}
                {section === 'project' && project && (
                    <section className="site-section">
                        <h2>{siteContent.projects.heading}</h2>
                        <ProjectCard project={project} />
                        <p className="site-muted">
                            Found {projectsFound} of {items.length}.{' '}
                            {projectsFound < items.length ? siteContent.projects.intro : 'You found them all!'}
                        </p>
                    </section>
                )}
                {section === 'contact' && <ContactSection />}
                <button type="button" className="info-panel-continue" onClick={onClose}>
                    {section === 'contact' ? 'Keep exploring' : 'Continue'}
                </button>
            </div>
        </div>
    )
}
