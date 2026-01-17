import requests
import json
import time

COOKIES = {}
with open('/tmp/barmania_cookies.txt', 'r') as f:
    for line in f:
        if line.startswith('#') or not line.strip():
            continue
        parts = line.strip().split('\t')
        if len(parts) >= 7:
            COOKIES[parts[5]] = parts[6]

print(f"Loaded cookies: {COOKIES}")

# Fetch all clips
all_clips = []
chunk_nr = 0
total = None

while True:
    url = f'https://www.barmania.nl/query/getcliplist.php?count=65&cat=all&sort=dateasc&chunknr={chunk_nr}'
    response = requests.post(url, cookies=COOKIES)
    
    if response.text == 'No_results' or not response.text.strip():
        print(f"No more results at chunk {chunk_nr}")
        break
    
    try:
        data = response.json()
        if not data or (isinstance(data, str) and data == 'No_results'):
            break
        
        if total is None:
            total = data[0].get('total', 0)
            print(f"Total clips: {total}")
        
        all_clips.extend(data)
        print(f"Chunk {chunk_nr}: fetched {len(data)} clips (total so far: {len(all_clips)})")
        
        if len(all_clips) >= total:
            break
        
        chunk_nr += 1
        time.sleep(0.3)  # Be nice to the server
        
    except Exception as e:
        print(f"Error at chunk {chunk_nr}: {e}")
        break

# Save to file
with open('/tmp/barmania_all_clips.json', 'w') as f:
    json.dump(all_clips, f, indent=2)

print(f"\nTotal clips fetched: {len(all_clips)}")
print("Saved to /tmp/barmania_all_clips.json")
