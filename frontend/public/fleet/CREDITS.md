# Fleet photography — sources and licences

Every photograph in `public/fleet/` is used under a licence that permits
commercial use. Two are CC0 (no conditions); one requires attribution, which
is given in the site footer and repeated here.

| File | Subject | Source (Wikimedia Commons) | Author | Licence |
| --- | --- | --- | --- | --- |
| `sedan.jpg` | Toyota Camry (XV70), black | [Moscow, Toyota Camry (XV70) black, Oct 2025 01](https://commons.wikimedia.org/wiki/File:Moscow,_Toyota_Camry_(XV70)_black,_Oct_2025_01.jpg) | Retired electrician | CC0 1.0 |
| `suv.jpg` | Toyota Land Cruiser Prado (J250), sand | [Moscow, Toyota Land Cruiser Prado (J250) July 2026 01](https://commons.wikimedia.org/wiki/File:Moscow,_Toyota_Land_Cruiser_Prado_(J250)_July_2026_01.jpg) | Retired electrician | CC0 1.0 |
| `van.jpg` | Toyota HiAce 3.0 GL Grandia, black | [2018 Toyota Hiace 3.0 GL Grandia in Black Mica](https://commons.wikimedia.org/wiki/File:2018_Toyota_Hiace_3.0_GL_Grandia_in_Black_Mica,_01-20-2024.jpg) | Ethan Llamas | CC BY-SA 4.0 |

## How they are processed

Source resolution is 3600×2401 (sedan, SUV) and 5440×3498 (van). Each is
centre-cropped to 16:9 with the crop biased so the wheels stay in frame, then
resized to 2000×1125 and saved as a progressive JPEG at quality 80 — around
350 KB each. `next/image` serves them responsively at the size the layout
actually asks for.

A light CSS treatment (`.fleet-photo`: `saturate(.9) contrast(1.05)
brightness(.94)`) plus the band's scrim pulls three photographs taken in three
cities toward one tone.

## Replacing a photo

Overwrite the file, keep the 16:9 crop and roughly 2000 px width, and update
the row above with the new source and licence. If the licence is not CC0, the
footer attribution must name the author.
