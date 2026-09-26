import { Project, siteContent } from 'content/siteContent'
import './Sections.css'

/*
 * The site's content sections. Used by both the game's pop-up panels and the plain view.
 */

const { about, work, projects, contact } = siteContent

export const AboutSection = () => (
    <section className="site-section">
        <h2>{about.heading}</h2>
        {about.paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
        ))}
    </section>
)

export const WorkSection = () => (
    <section className="site-section">
        <h2>{work.heading}</h2>
        <p>{work.intro}</p>
        {work.jobs.map((job, i) => (
            <div className="site-job" key={i}>
                <h3>
                    {job.title} <span className="site-muted">· {job.company}</span>
                </h3>
                <div className="site-muted">{job.dates}</div>
                <p>{job.summary}</p>
            </div>
        ))}
        {work.skills.length > 0 && (
            <ul className="site-tags">
                {work.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                ))}
            </ul>
        )}
        {work.resumeElsewhere && (
            <p>
                My full resume is on{' '}
                <a href={work.resumeElsewhere.url} target="_blank" rel="noreferrer">
                    {work.resumeElsewhere.label}
                </a>
                .
            </p>
        )}
        {work.resumeUrl && (
            <a className="site-button" href={work.resumeUrl} target="_blank" rel="noreferrer">
                Download resume
            </a>
        )}
    </section>
)

export const ProjectCard = ({ project }: { project: Project }) => (
    <div className="site-project">
        <h3>{project.name}</h3>
        <p>{project.description}</p>
        {project.url && (
            <a href={project.url} target="_blank" rel="noreferrer">
                Take a look →
            </a>
        )}
    </div>
)

export const ProjectsSection = () => (
    <section className="site-section">
        <h2>{projects.heading}</h2>
        {projects.items.map((project) => (
            <ProjectCard project={project} key={project.name} />
        ))}
    </section>
)

export const ContactLinks = () => (
    <ul className="site-links">
        {contact.links.map((link) => (
            <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                </a>
            </li>
        ))}
    </ul>
)

export const ContactSection = ({ heading = contact.heading }: { heading?: string }) => (
    <section className="site-section">
        <h2>{heading}</h2>
        <p>{contact.intro}</p>
        <ContactLinks />
    </section>
)
