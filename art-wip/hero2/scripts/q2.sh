cd /workspace/hero2
POS="masterpiece, best quality, very aesthetic, absurdres, 1girl, solo, adult woman, mature, full body, standing, facing viewer, front view, long platinum blonde hair, human ears, calm wise expression, beautiful face, white and emerald green sage robes with gold trim, deep v neckline, visible cleavage, shapely bust, short sleeves, bare forearms, elegant visible hands, golden bracelets, detailed anime illustration, cel shading, sharp lineart"
NEG="elf, pointy ears, long sleeves, hidden hands, covered arms, bad hands, extra fingers, nude, nipples, child, loli"
mkdir -p sage/r1 && python3 refine.py sage/front-woman/s0.4-1.png sage/r1/r "$POS" "$NEG" > sage-r1.log 2>&1
A="sleek humanoid android, synthetic pale skin with thin glowing blue seam lines on face and arms, short silver hair, glowing cyan eyes, fitted black and white bodysuit with minimal armor plates, blue light core in chest, elegant cyberpunk, calm cold expression"
B="cyber ninja android, lightweight dark navy armor with white plates, glowing blue visor lines, silver hair, half face mask, energy blade holster on back, blue energy circuits, agile slim build, dynamic cyberpunk design"
TAG=front-a python3 front2.py android "$A" 0.25 > android-a.log 2>&1
TAG=front-b python3 front2.py android "$B" 0.25 > android-b.log 2>&1
echo Q2_DONE > q2.done
