import requests
import json

BASE_URL = 'http://localhost:5000/api'

def test_api():
    # Create new test user
    register_data = {
        'username': 'testuser2',
        'email': 'test2@example.com',
        'password': 'Password123'
    }
    
    response = requests.post(f'{BASE_URL}/auth/register', json=register_data)
    print("\nRegister/Login response:", response.status_code)
    print("Response:", response.text)
    
    if not response.ok:
        # Try logging in if registration fails
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'email': register_data['email'],
            'password': register_data['password']
        })
        print("\nFallback login response:", response.status_code)
        print("Response:", response.text)
        
    if response.ok:
        token = response.json()['token']
    print("\nLogin response:", response.status_code)
    print("Response:", response.text)
    if response.ok:
        print(json.dumps(response.json(), indent=2))
        token = response.json()['token']
        
        # Test tracks endpoint
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f'{BASE_URL}/tracks', headers=headers)
        print("\nTracks response:", response.status_code)
        if response.ok:
            result = response.json()
            print(f"Total tracks: {result.get('total', 0)}")
            print(f"Current page: {result.get('current_page', 1)}")
            print(f"Total pages: {result.get('pages', 0)}")
            tracks = result.get('tracks', [])
            print(f"\nFirst {len(tracks)} tracks:")
            for track in tracks:
                print(f"- {track['title']} (ID: {track['track_id']})")
        else:
            print("Error:", response.text)

if __name__ == '__main__':
    test_api()