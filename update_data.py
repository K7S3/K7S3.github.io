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
            'title': 'Allosteric Communication Mediated by Protein Contact Clusters: A Dynamical Model',
            'authors': 'Keshavan Seshadri, Kalyan C. Tirupula, Kavita Iyer, Naveena Yanamala, and Judith Klein-Seetharaman',
            'venue': 'Journal of Chemical Information and Modeling',
            'year': '2023',
            'abstract': 'We present a dynamical model for allosteric communication based on protein contact clusters. Our approach reveals how conformational changes propagate through protein structures, providing insights into the fundamental mechanisms of allostery.',
            'citations': 5,
            'url': 'https://pubs.acs.org/doi/abs/10.1021/acs.jcim.3c00401',
            'image': 'https://pubs.acs.org/cms/10.1021/acs.jcim.3c00401/asset/images/medium/ci3c00401_0007.gif'
        },
        {
            'title': 'Building a Raspberry Pi Spectrophotometer for Undergraduate Chemistry Education',
            'authors': 'Keshavan Seshadri et al.',
            'venue': 'Journal of Chemical Education',
            'year': '2020',
            'abstract': 'We developed a low-cost, Raspberry Pi-based spectrophotometer for undergraduate chemistry education. This DIY instrument provides hands-on learning opportunities while maintaining analytical precision suitable for educational purposes.',
            'citations': 12,
            'url': 'https://pubs.acs.org/doi/10.1021/acs.jchemed.0c00579',
            'image': 'https://pubs.acs.org/cms/10.1021/acs.jchemed.0c00579/asset/images/medium/ed0c00579_0004.gif'
        },
        {
            'title': 'A Computational Study on GPCR Activation Mechanisms: Insights from Adrenaline Binding and G-Protein Dissociation',
            'authors': 'Keshavan Seshadri et al.',
            'venue': 'International Institute of Information Technology, Hyderabad',
            'year': '2023',
            'abstract': 'GPCRs are the most prominent family of membrane proteins that serve as major targets for one-third of the drugs produced. A detailed understanding of the molecular mechanism of drug-induced activation and inhibition of GPCRs is crucial for the rational design of novel therapeutics.',
            'citations': 8,
            'url': 'https://scholar.google.com/citations?user=3M3fxRYAAAAJ',
            'image': None
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
            'date': 'Present',
            'title': 'Prudential Financial',
            'description': 'Working on innovative financial technology solutions and AI applications',
            'type': 'work'
        },
        {
            'date': '2024',
            'title': 'Break Through Tech Mentor',
            'description': 'Mentoring students to help them get into Tech and AI',
            'type': 'volunteer'
        },
        {
            'date': '2023',
            'title': 'Cornell University',
            'description': 'Graduated with degree in Computer Science',
            'type': 'education'
        },
        {
            'date': '2023',
            'title': 'IIIT Hyderabad Research',
            'description': 'Published research on GPCR Activation Mechanisms',
            'type': 'research'
        },
        {
            'date': '2022',
            'title': 'LinkedIn Learning',
            'description': 'Completed SQL: Data Reporting and Analysis certification',
            'type': 'certification'
        }
    ]
    
    return timeline

def update_data_js():
    """Update the data.js file with fetched data"""
    github_projects = fetch_github_data()
    publications = fetch_google_scholar_data()
    timeline = fetch_linkedin_data()
    
    data = {
        'lastUpdated': datetime.now().isoformat(),
        'projects': github_projects,
        'publications': publications,
        'timeline': timeline,
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
                'date': 'January 2025',
                'title': 'Won Grand Prize at AI Berkeley Hackathon',
                'description': 'Our team built ChipChat, an innovative solution that won the Grand Prize at the 2025 AI Berkeley Hackathon!',
                'type': 'achievement'
            },
            {
                'date': 'October 2024',
                'title': 'Mentoring at Break Through Tech',
                'description': 'Started mentoring students to help them get into Tech and AI through Break Through Tech program.',
                'type': 'volunteer'
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