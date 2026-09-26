/*
 * All of the site's words and links live here.
 * Both the game's pop-up panels and the plain view read from this file,
 * so edit text here and it changes everywhere.
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
        // Shown as "My full resume is on <link>." under the jobs.
        resumeElsewhere?: ContactLink
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
    tagline: 'Engineering leader, builder, occasional gamer.',
    about: {
        heading: 'About Me',
        paragraphs: [
            'Hello player!  Welcome to my site.  Have fun and learn a little bit about me in the process.',
            'I am Fred Gohsman, a professional software engineer, architect, and AI maestro with over 25 years in the industry.  I have spent time in product development, consulting, a couple years at Microsoft, and most recently transforming the BankFabric development team at Truvio into a mean lean AI code crunching machine.',
            'My hub is in southwest Florida but I can often be found all around the world working, traveling, integrating. Besides being a professional software engineer for over 25 years, I dabble in game development, woodworking, and horticulture.',
        ],
    },
    work: {
        heading: 'Work & Resume',
        intro: 'I lead by example, take pride in my work, and take quality seriously.  Everything else, not so much.',
        jobs: [
            {
                title: 'Senior Azure Technical Architect',
                company: 'SKsoft, now Truvio',
                dates: '01/2024 - present',
                summary: 'I am a hands-on leader who has transformed our team into an AI-first engineering team.',
            },
            {
                title: 'Senior Customer Engineer (Azure)',
                company: 'Microsoft',
                dates: '06/2021 - 09/2023',
                summary: 'Worked closely with customers to turn their on-premise applications into scalable, reliable, cloud-first solutions.',
            },
            {
                title: 'Senior Software Developer Consultant',
                company: 'AgileThought',
                dates: '2015 - 2021',
                summary: 'Architect and develop custom software solutions for customers in the finance, healthcare, and manufacturing industries.',
            },
            {
                title: 'CEO, Founder',
                company: 'KETL Internet Consulting',
                dates: '1998 - 2010',
                summary: 'Founded and led a professional Midwest based software consulting company.',
            },
        ],
        skills: ['Azure', 'C#', '.NET', 'AI-first development', 'Software architecture', 'Leadership'],
        // To offer a download instead, drop a PDF in the public folder (e.g. public/resume.pdf) and set this to '/resume.pdf'.
        resumeUrl: undefined,
        resumeElsewhere: { label: 'LinkedIn', url: 'https://www.linkedin.com/in/fredgohsman' },
    },
    projects: {
        heading: 'Projects',
        intro: 'Hit every block to find them all.',
        items: [
            {
                name: 'This website',
                description:
                    'A playable side-scrolling game (three worlds and a boss fight) built from scratch with React, TypeScript and an HTML canvas.',
                url: 'https://github.com/fredgohsman/gohsman.com',
            },
            {
                name: 'Chomp',
                description:
                    'A virtual reality 3-D game in the style of PacMan for Android with 3-D glasses adapter.  Mobile version also available.',
            },
            {
                name: 'BankFabric',
                description:
                    'BankFabric is a product by SKsoft, a division of Truvio which manages global bank payments.  Go to the link to find out more!',
                url: 'https://bankfabric.sksoft.com/',
            },
            {
                name: 'Web3 game utilities',
                description:
                    'A variety of utility sites for Web3 games when I was into that: one for looking up the value of NFTs in MonkeyLeague, and one for looking up NFTs and matching them to compatible NFTs in DeFi Kingdoms.  Both sites were maintained for a few years; the games have since moved on and the sites lost their utility, but they were a fun experiment in the world of Web3.',
            },
        ],
    },
    contact: {
        heading: 'Course Clear!',
        intro: "Thanks for playing. Let's connect:",
        links: [
            { label: 'GitHub', url: 'https://github.com/fredgohsman' },
            { label: 'LinkedIn', url: 'https://www.linkedin.com/in/fredgohsman' },
            { label: 'Email', url: 'mailto:resume@mail.gohsman.com' },
        ],
    },
}
