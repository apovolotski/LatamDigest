"""Render the listing's original typography graphic; no screenshot simulation."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
im=Image.new('RGB',(1024,500),'#073F49');d=ImageDraw.Draw(im)
regular='/System/Library/Fonts/Supplemental/Arial.ttf'
bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def f(size,heavy=False):return ImageFont.truetype(bold if heavy else regular,size)
for r in (190,250,310):d.ellipse((850-r,250-r,850+r,250+r),outline='#13616A',width=2)
d.rounded_rectangle((64,68,198,78),radius=5,fill='#FFC247')
d.text((64,110),'Latam Digest',font=f(66,True),fill='white')
d.text((68,213),'Read the region.',font=f(36),fill='#D8EEEC')
d.text((68,261),'Keep your perspective.',font=f(36),fill='#D8EEEC')
d.text((68,405),'24 COUNTRIES   /   ORIGINAL SOURCES   /   PRIVATE NOTES',font=f(19,True),fill='#FFC247')
im.save(root/'store-listing/feature-graphic.png')
