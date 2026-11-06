import { Link } from 'react-router-dom'
import { siteContent } from 'content/siteContent'
import { AboutSection, ContactSection, ProjectsSection, WorkSection } from 'components/Sections/Sections'
import './PlainView.css'

// All site sections, one after another.
export const PlainContent = () => (
    <>
        <AboutSection />
        <WorkSection />
        <ProjectsSection />
        <ContactSection heading="Contact" />
    </>
)

// The site without the game, for anyone who would rather read than play.
export const PlainView = () => (
    <main className="plain-view">
        <div className="plain-card">
            <p className="plain-tagline">{siteContent.tagline}</p>
            <PlainContent />
            <Link className="plain-play" to="/?play=1">
                ▶ Play the game instead
            </Link>
        </div>
    </main>
)
