#!/bin/bash
# B.A.S Sangha - asset generation (sequential with retries)
cd /home/z/my-project/public/images

gen() {
  local out="$1"; local prompt="$2"; local size="$3"
  if [ -f "$out" ] && [ $(stat -c%s "$out") -gt 20000 ]; then echo "SKIP: $out (exists)"; return 0; fi
  for attempt in 1 2 3 4 5; do
    if z-ai image -p "$prompt" -o "$out" -s "$size" >/dev/null 2>&1 && [ -f "$out" ] && [ $(stat -c%s "$out") -gt 20000 ]; then
      echo "OK: $out (attempt $attempt)"; sleep 8; return 0
    fi
    echo "RETRY($attempt): $out waiting..."; sleep 25
  done
  echo "FAIL: $out"; return 1
}

gen banner-football.png "Professional football soccer tournament banner background, golden trophy with football on green stadium field at night, dramatic floodlights, confetti, festive red and gold color theme, empty center space for text, no text, no words, no letters, premium poster design, high quality, detailed" 1440x720
gen banner-cricket.png "Professional cricket tournament banner background, cricket bat and red ball with golden trophy, stadium floodlights at dusk, dramatic sky, blue and gold festive color theme, empty center space for text, no text, no words, no letters, premium poster design, high quality, detailed" 1440x720
gen banner-drawing.png "Children drawing competition banner background, colorful crayons paint brushes and palette, rainbow paint splashes, kids artwork papers, bright cheerful yellow and orange theme, empty center space for text, no text, no words, no letters, playful premium poster design, high quality" 1440x720
gen banner-blood.png "Blood donation camp banner background, red blood drops and heart shapes, gentle hands holding a heart, medical care theme, deep red and soft white color theme, hopeful and caring mood, empty center space for text, no text, no words, no letters, premium poster design, high quality" 1440x720
gen kali-maa.png "Divine Hindu Goddess Maa Kali devotional artwork, benevolent blessing form with golden crown and glowing halo, standing majestically, dark night sky with fireworks and diyas oil lamps, marigold flower garlands, temple silhouette, rich deep red blue and gold tones, spiritual painting style, respectful, highly detailed, premium quality" 864x1152
gen blood-drop.png "Single glossy shiny red blood drop with soft reflection and small heart beside it, clean minimal illustration on pure white background, vector style, high quality" 1024x1024
gen member-1.png "Photorealistic portrait of a smiling middle aged Indian Bengali man with moustache wearing light blue casual shirt, warm friendly expression, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen member-2.png "Photorealistic portrait of a dignified elderly Indian Bengali man with white hair and glasses wearing traditional kurta, gentle smile, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen member-3.png "Photorealistic portrait of a smiling young Indian Bengali woman wearing elegant red saree with gold border, warm friendly expression, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen member-4.png "Photorealistic portrait of a cheerful young Indian Bengali man wearing white polo t-shirt, confident smile, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen member-5.png "Photorealistic portrait of a kind middle aged Indian Bengali woman wearing simple green saree, warm smile, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen member-6.png "Photorealistic portrait of a friendly Indian Bengali man in his forties wearing checked shirt, smiling, plain soft grey studio background, professional headshot photography, high quality" 768x1344
gen event-1.png "Candid photo of trophy distribution ceremony at an Indian village community club annual sports event, winners holding trophy on small stage, evening festive string lights, crowd, joyful atmosphere, documentary photography, high quality" 1344x768
gen event-2.png "Candid photo of colorful Indian cultural dance performance on outdoor stage at night village club festival, stage lights, audience, festive atmosphere, documentary photography, high quality" 1344x768
gen event-3.png "Candid photo of blood donation camp inside Indian community hall, young donors lying on donation beds with nurses attending, red banners, daylight, caring atmosphere, documentary photography, high quality" 1344x768
gen event-4.png "Candid photo of children receiving prizes at drawing competition award ceremony in Indian village club, kids holding paintings, happy faces, decorated hall, documentary photography, high quality" 1344x768
gen event-5.png "Candid photo of Indian village club football team celebrating with trophy on muddy green field, sunset golden light, teammates cheering, documentary photography, high quality" 1344x768
gen event-6.png "Candid photo of Indian community members gathering for club annual general meeting with flags and flowers decoration, daytime, village courtyard, documentary photography, high quality" 1344x768

echo "ALL DONE"
