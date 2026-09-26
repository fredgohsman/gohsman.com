/*
 * All of the site's words and links live here.
 * Both the game's pop-up panels and the plain view read from this file,
 * so edit text here and it changes everywhere.
 *
 * Anything marked [Replace me] is placeholder text.
 */

export interface Job {
    title: string
    company: string
    dates: string
    summary: string
}

export interface Project {
    name: string
    description: string
    url?: string
}

export interface ContactLink {
    label: string
    url: string
}

export interface SiteContent {
    name: string
    tagline: string
    about: {
        heading: string
        paragraphs: string[]
    }
    work: {
        heading: string
        intro: string
        jobs: Job[]
        skills: string[]
        resumeUrl?: string
    }
    projects: {
        heading: string
        intro: string
        items: Project[]
    }
    contact: {
        heading: string
        intro: string
        links: ContactLink[]
    }
}

export const siteContent: SiteContent = {
    name: 'Fred Gohsman',
    tagline: '[Replace me] A one-line description of what you do.',
    about: {
        heading: 'About Me',
        paragraphs: [
            '[Replace me] A short hello: who you are and what you care about.',
            '[Replace me] A second paragraph: where you are based, what you do outside of work, or what you are working on right now.',
        ],
    },
    work: {
        heading: 'Work & Resume',
        intro: '[Replace me] One sentence summing up your career.',
        jobs: [
            {
                title: '[Replace me] Job title',
                company: '[Replace me] Company',
                dates: '20XX - Present',
                summary: '[Replace me] What you do and the impact you have.',
            },
            {
                title: '[Replace me] Previous job title',
                company: '[Replace me] Previous company',
                dates: '20XX - 20XX',
                summary: '[Replace me] Highlights from this role.',
            },
        ],
        skills: ['[Replace me] Skill one', 'Skill two', 'Skill three'],
        // Drop a PDF in the public folder (for example public/resume.pdf) and set this to '/resume.pdf'.
        resumeUrl: undefined,
    },
    projects: {
        heading: 'Projects',
        intro: 'Hit every block to find them all.',
        items: [
            {
                name: 'This website',
                description: 'A playable side-scrolling level built from scratch with React, TypeScript and an HTML canvas.',
                url: 'https://github.com/fredgohsman/gohsman.com',
            },
            {
                name: '[Replace me] Project two',
                description: '[Replace me] What it is and why it matters.',
            },
            {
                name: '[Replace me] Project three',
                description: '[Replace me] What it is and why it matters.',
            },
            {
                name: '[Replace me] Blog or writing',
                description: '[Replace me] Where people can read what you write.',
            },
        ],
    },
    contact: {
        heading: 'Course Clear!',
        intro: "Thanks for playing. Let's connect:",
        links: [
            { label: 'GitHub', url: 'https://github.com/fredgohsman' },
            { label: '[Replace me] LinkedIn', url: 'https://www.linkedin.com/' },
            { label: '[Replace me] Email', url: 'mailto:hello@example.com' },
        ],
    },
}
