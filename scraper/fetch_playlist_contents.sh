#!/bin/bash
COOKIES="/tmp/barmania_cookies.txt"

# Read playlist IDs from playlists file
playlist_ids=$(python3 -c "import json; f=open('/tmp/barmania_playlists.json'); d=json.load(f); print(' '.join([p['id'] for p in d]))")

echo "Fetching contents for playlists: $playlist_ids"

mkdir -p /tmp/barmania_playlist_contents

for plid in $playlist_ids; do
    echo "Fetching playlist $plid..."
    curl -s -b "$COOKIES" "https://www.barmania.nl/query/loadplaylist.php?id=$plid" > "/tmp/barmania_playlist_contents/playlist_$plid.json"
    sleep 0.2
done

echo "Done fetching playlist contents"
