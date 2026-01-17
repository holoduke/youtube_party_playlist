#!/bin/bash
COOKIES="/tmp/barmania_cookies.txt"
OUTPUT_DIR="/tmp/barmania_chunks"
mkdir -p $OUTPUT_DIR

chunk=0
all_clips="["
first=true

while true; do
    echo "Fetching chunk $chunk..."
    response=$(curl -s -b "$COOKIES" "https://www.barmania.nl/query/getcliplist.php?count=65&cat=all&sort=dateasc&chunknr=$chunk")
    
    if [[ "$response" == "No_results" ]] || [[ -z "$response" ]] || [[ "$response" == "null" ]]; then
        echo "No more results at chunk $chunk"
        break
    fi
    
    # Save chunk
    echo "$response" > "$OUTPUT_DIR/chunk_$chunk.json"
    
    # Get count from response
    count=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    
    if [[ -z "$count" ]] || [[ "$count" == "0" ]]; then
        echo "Empty chunk at $chunk"
        break
    fi
    
    echo "  Got $count clips"
    
    chunk=$((chunk + 1))
    sleep 0.3
    
    # Safety limit
    if [[ $chunk -gt 200 ]]; then
        echo "Reached safety limit"
        break
    fi
done

echo "Total chunks: $chunk"

# Merge all chunks
echo "Merging chunks..."
python3 << 'PYTHON'
import json
import glob

all_clips = []
for f in sorted(glob.glob('/tmp/barmania_chunks/chunk_*.json'), key=lambda x: int(x.split('_')[-1].split('.')[0])):
    with open(f) as fp:
        data = json.load(fp)
        all_clips.extend(data)
        
print(f"Total clips: {len(all_clips)}")

# Remove duplicates by id
unique_clips = {}
for clip in all_clips:
    unique_clips[clip['id']] = clip

clips_list = list(unique_clips.values())
print(f"Unique clips: {len(clips_list)}")

with open('/tmp/barmania_all_clips.json', 'w') as f:
    json.dump(clips_list, f, indent=2)
    
print("Saved to /tmp/barmania_all_clips.json")
PYTHON
