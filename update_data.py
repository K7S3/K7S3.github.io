import json
import requests
from datetime import datetime
import time

def fetch_github_data():
    """Fetch repository data from GitHub API"""
    # Define priority projects
    priority_repos = ['synergii', '3dmol.js', 'endless-runner', 'k7-shell', 'fighter-jet', 'gpcr_ml_residue_importance']
    
    try:
        response = requests.get('https://api.github.com/users/K7S3/repos?sort=updated&per_page=50')
        repos = response.json()
        
        # Process and format the data
        projects = []
        priority_projects = []
        other_projects = []
        
        for repo in repos:
            project = {
                'name': repo['name'],
                'description': repo['description'] or 'No description available',
                'url': repo['html_url'],
                'homepage': repo['homepage'],
                'language': repo['language'],
                'stars': repo['stargazers_count'],
                'forks': repo['forks_count'],
                'updated_at': repo['updated_at']
            }
            
            # Check if it's a priority project
            if repo['name'].lower() in [p.lower() for p in priority_repos]:
                priority_projects.append(project)
            else:
                other_projects.append(project)
        
        # Sort priority projects by the order defined
        sorted_priority = []
        for priority_name in priority_repos:
            for proj in priority_projects:
                if proj['name'].lower() == priority_name.lower():
                    sorted_priority.append(proj)
                    break
        
        # Combine priority projects first, then others
        projects = sorted_priority + other_projects[:10]  # Limit to top 10 other projects
        
        return projects
    except Exception as e:
        print(f"Error fetching GitHub data: {e}")
        return []

def fetch_google_scholar_data():
    """Fetch publication data from Google Scholar"""
    # Note: In a real implementation, you'd use the scholarly library
    # For now, we'll use static data that can be manually updated
    publications = [
        {
            'title': 'Molecular Dynamics and Machine Learning Study of Adrenaline Dynamics in the Binding Pocket of GPCR',
            'authors': 'Keshavan Seshadri, Marimuthu Krishnan',
            'venue': 'Journal of Chemical Information and Modeling',
            'year': '2023',
            'volume': '63 (14)',
            'pages': '4291-4300',
            'abstract': 'G-protein coupled receptors (GPCRs) are the most prominent family of membrane proteins that serve as major targets for one-third of the drugs produced. A detailed understanding of the molecular mechanism of drug-induced activation and inhibition of GPCRs is crucial for the rational design of novel therapeutics. The binding of the neurotransmitter adrenaline to the β2-adrenergic receptor (β2AR) is known to induce a flight or fight cellular response, but much remains to be understood about binding-induced dynamical changes in β2AR and adrenaline. In this article, we examine the potential of mean force (PMF) for the unbinding of adrenaline from the orthosteric binding site of β2AR and the associated dynamics using umbrella sampling and molecular dynamics (MD) simulations. The calculated PMF reveals a global energy minimum, which corresponds to the crystal structure of β2AR–adrenaline complex, and a meta-stable state in which the adrenaline is moved slightly deeper into the binding pocket with a different orientation compared to that in the crystal structure. The orientational and conformational changes in adrenaline during the transition between these two states and the underlying driving forces of this transition are also explored. Based on the clustering of MD configurations and machine learning-based statistical analyses of time series of relevant collective variables, the structures and stabilizing interactions of these two states of the β2AR–adrenaline complex are also investigated.',
            'citations': 4,
            'url': 'https://pubs.acs.org/doi/abs/10.1021/acs.jcim.3c00401',
            'image': 'images/md-ml-jcim.png',
            'doi': '10.1021/acs.jcim.3c00401'
        },
        {
            'title': 'The 3Dmol.js Learning Environment: A Classroom Response System for 3D Chemical Structures',
            'authors': 'K Seshadri, P Liu, DR Koes',
            'venue': 'Journal of Chemical Education',
            'year': '2020',
            'volume': '97 (10)',
            'pages': '3872-3876',
            'abstract': 'Classroom response systems are an important tool in many active learning pedagogies. They support real-time feedback on student learning and promote student engagement, even in large classrooms, by allowing instructors to solicit an answer to a question from all students and show the results. Existing classroom response systems are general purpose and not tailored to the specific needs of a chemistry classroom. In particular, it is not easy to deploy molecular representations except as static images. Here we present the 3Dmol.js learning environment, a classroom response system that uses the open-source web-based 3Dmol.js JavaScript framework to provide interactive viewing and querying of 3D molecules. 3Dmol.js is available under a BSD 3-clause open-source license, and the learning-environment features are all available through http://3dmol.csb.pitt.edu/ without any software installation required.',
            'citations': 14,
            'url': 'https://pubs.acs.org/doi/10.1021/acs.jchemed.0c00579',
            'image': 'images/3dmol-jchemed.png',
            'doi': '10.1021/acs.jchemed.0c00579'
        },
        {
            'title': 'A Computational Study on GPCR Activation Mechanisms: Insights from Adrenaline Binding and G-Protein Dissociation',
            'authors': 'Keshavan Seshadri',
            'venue': 'Master\'s Thesis, IIIT Hyderabad',
            'year': '2023',
            'abstract': 'GPCRs are the most prominent family of membrane proteins that serve as major targets for one-third of the drugs produced. A detailed understanding of the molecular mechanism of drug-induced activation and inhibition of GPCRs is crucial for the rational design of novel therapeutics. This thesis examines the potential of mean force (PMF) for the unbinding of adrenaline from the orthosteric binding site of β2AR and the associated dynamics using umbrella sampling and molecular dynamics (MD) simulations. The calculated PMF reveals a global energy minimum and a meta-stable state with different orientations. The findings enhance our understanding of GPCR activation and the advancement of new therapies aimed at GPCRs by offering comprehensive insights into conformational changes, energetics, and critical residues involved.',
            'citations': 0,
            'url': 'https://web2py.iiit.ac.in/research_centres/publications/download/mastersthesis.pdf.b003dd0b24ed8ba6.7468657369732e706466.pdf',
            'image': None,
            'thesis_number': 'IIIT/TH/2023/130',
            'type': 'thesis'
        }
    ]
    
    # In production, you would use:
    # from scholarly import scholarly
    # author = scholarly.search_author_id('3M3fxRYAAAAJ')
    # author = scholarly.fill(author)
    # publications = []
    # for pub in author['publications']:
    #     pub_filled = scholarly.fill(pub)
    #     publications.append({...})
    
    return publications

def fetch_linkedin_data():
    """Fetch timeline data from LinkedIn"""
    # Note: LinkedIn scraping is complex and requires authentication
    # For GitHub Pages, we'll use static data that can be manually updated
    timeline = [
        {
            'date': 'Aug 2024 - Present',
            'title': 'Senior Machine Learning Engineer - Prudential Financial',
            'description': 'Developed real-time Table Augmented Generation (TAG) system using AWS, DuckDB, FastAPI, GPT-4. Enhanced prompt management framework for AI agent development. Built automated GenAI API validation system.',
            'type': 'work'
        },
        {
            'date': 'Nov 2023 - May 2024',
            'title': 'Technical Founder - Synergii',
            'description': 'Built AI-based grant discovery platform using RAG, GPT-4, BERT. Captured $34B market opportunity with $85M revenue projections. Secured Cornell Johnson Summer Startup Accelerator spot.',
            'type': 'work'
        },
        {
            'date': 'Jul 2022 - Dec 2022',
            'title': 'Software Engineer - BrowserStack',
            'description': 'Implemented features for Playwright, Puppeteer, and Cypress test frameworks. Contributed to framework maintenance and debugging for "Automate" product.',
            'type': 'work'
        },
        {
            'date': 'Sep 2021 - Nov 2021',
            'title': 'AI Developer - Couture.ai',
            'description': 'Developed GUI platform for training ResNet, Inception, Deep Speech models. Built AI platform for flagging violent/NSFW content in news videos.',
            'type': 'work'
        },
        {
            'date': 'May 2021 - Sep 2021',
            'title': 'Mitacs Globalink Researcher - Queen\'s University',
            'description': 'Worked with Dr. Farnaz Heidar-Zadeh on physics-based ML models to predict quantum-mechanical observables using QM17 dataset.',
            'type': 'research'
        },
        {
            'date': 'Jul 2019 - May 2020',
            'title': 'Teaching Assistant - IIIT Hyderabad',
            'description': 'Conducted tutorials for 200+ students in Science courses. Managed 20+ students in molecular dynamics projects.',
            'type': 'teaching'
        },
        {
            'date': 'May 2019 - Aug 2019',
            'title': 'Google Summer of Code - Open Chemistry',
            'description': 'Extended 3DMol.js library for active learning. Published in Journal of Chemical Education. Real-time sync for 1000s of users.',
            'type': 'research'
        },
        {
            'date': 'May 2018 - Nov 2018',
            'title': 'Associate Researcher - Virtual Labs VLEAD',
            'description': 'Developed game-based learning tool for Data Structures used by millions. Delivered workshops to 200+ industry enthusiasts.',
            'type': 'research'
        }
    ]
    
    # Separate education data (no dates needed)
    education = [
        {
            'institution': 'Cornell University',
            'degree': 'Master\'s in Computer Science',
            'program': 'Cornell Tech',
            'type': 'masters'
        },
        {
            'institution': 'IIIT Hyderabad',
            'degree': 'Bachelor\'s in Computer Science',
            'program': 'Dual Degree Program',
            'type': 'bachelors'
        },
        {
            'institution': 'IIIT Hyderabad',
            'degree': 'Master\'s in Computational Natural Sciences',
            'program': 'Research Focus: GPCR Dynamics',
            'type': 'masters'
        }
    ]
    
    return timeline, education

def update_data_js():
    """Update the data.js file with fetched data"""
    github_projects = fetch_github_data()
    publications = fetch_google_scholar_data()
    timeline, education = fetch_linkedin_data()
    
    data = {
        'lastUpdated': datetime.now().isoformat(),
        'projects': github_projects,
        'publications': publications,
        'timeline': timeline,
        'education': education,
        'news': [
            {
                'date': 'June 2025',
                'title': 'Speaking at AI Accelerator Institute - Agentic AI Summit NYC',
                'description': 'Panel discussion on "Explainability and transparency in autonomous agents" at the prestigious AI Accelerator Institute event in New York City.',
                'link': 'https://world.aiacceleratorinstitute.com/location/agenticainewyork/speaker/keshavanseshadri',
                'type': 'speaking'
            },
            {
                'date': 'June 2025',
                'title': 'Featured Speaker at BattleFin Discovery Day',
                'description': 'Speaking at BattleFin\'s premier alternative data and AI conference for financial services in New York.',
                'link': 'https://www.battlefin.com/events/new-york-2025-new',
                'type': 'speaking'
            },
            {
                'date': 'May 2025',
                'title': 'Panel at Put Data First Conference',
                'description': 'Participating as a speaker at the Put Data First conference, discussing the future of data-driven innovation.',
                'link': 'https://www.putdatafirst.com/#Speakers',
                'type': 'speaking'
            },

            {
                'date': 'October 2024',
                'title': 'Mentoring at Break Through Tech',
                'description': 'Started mentoring students to help them get into Tech and AI through Break Through Tech program.',
                'type': 'volunteer'
            },
            {
                'date': 'Summer 2024',
                'title': 'Cornell Summer Startup Accelerator',
                'description': 'Selected for the prestigious Johnson Summer Startup Accelerator at Cornell University. Co-founded Synergii, which received 1000+ requests within 2 weeks of launch.',
                'link': 'https://eship.cornell.edu/johnson-entrepreneurship-track-academic-courses/johnson-summer-startup-accelerator-2024-cohort-2/',
                'type': 'achievement'
            }
        ]
    }
    
    # Write to data.js file
    with open('data.js', 'w') as f:
        f.write(f'// Auto-generated data - Last updated: {data["lastUpdated"]}\n')
        f.write('const websiteData = ')
        f.write(json.dumps(data, indent=2))
        f.write(';\n')
    
    print(f"Data updated successfully at {data['lastUpdated']}")

if __name__ == "__main__":
    update_data_js() 