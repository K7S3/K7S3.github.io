import json
import requests
from datetime import datetime
import time

def fetch_github_data():
    """Fetch repository data from GitHub API"""
    try:
        response = requests.get('https://api.github.com/users/K7S3/repos?sort=updated&per_page=20')
        repos = response.json()
        
        # Process and format the data
        projects = []
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
            projects.append(project)
        
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
            'title': 'A Computational Study on GPCR Activation Mechanisms: Insights from Adrenaline Binding and G-Protein Dissociation',
            'authors': 'Keshavan Seshadri et al.',
            'venue': 'International Institute of Information Technology, Hyderabad',
            'year': '2023',
            'abstract': 'GPCRs are the most prominent family of membrane proteins that serve as major targets for one-third of the drugs produced. A detailed understanding of the molecular mechanism of drug-induced activation and inhibition of GPCRs is crucial for the rational design of novel therapeutics.',
            'citations': 0,
            'url': 'https://scholar.google.com/citations?user=3M3fxRYAAAAJ'
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
                'date': 'January 2025',
                'title': 'Won Grand Prize at AI Berkeley Hackathon',
                'description': 'Our team built ChipChat, an innovative solution that won the Grand Prize at the 2025 AI Berkeley Hackathon!'
            },
            {
                'date': 'December 2024',
                'title': 'Panel Discussion on Explainable AI',
                'description': 'Participated in a panel discussion on Explainability and Transparency in Autonomous Agents.'
            },
            {
                'date': 'October 2024',
                'title': 'Mentoring at Break Through Tech',
                'description': 'Started mentoring students to help them get into Tech and AI through Break Through Tech program.'
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