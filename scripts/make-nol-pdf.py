import re
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV', D+'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB', D+'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DVM', D+'DejaVuSansMono.ttf'))
from reportlab.lib.fonts import addMapping
addMapping('DV',0,0,'DV'); addMapping('DV',1,0,'DVB')
navy=colors.HexColor('#12244f'); royal=colors.HexColor('#2552e0'); grey=colors.HexColor('#4a5468')
H1=ParagraphStyle('h1',fontName='DVB',fontSize=20,leading=25,textColor=navy,spaceAfter=4)
META=ParagraphStyle('m',fontName='DV',fontSize=10.5,leading=14,textColor=grey,spaceAfter=10)
DAY=ParagraphStyle('d',fontName='DVB',fontSize=14,leading=18,textColor=navy,spaceBefore=10,spaceAfter=6)
SEC=ParagraphStyle('s',fontName='DVB',fontSize=11,leading=15,textColor=royal,spaceBefore=6,spaceAfter=3)
ITEM=ParagraphStyle('i',fontName='DV',fontSize=10.5,leading=14.5,leftIndent=14,firstLineIndent=-10,spaceAfter=1.5)
END=ParagraphStyle('e',fontName='DVB',fontSize=11,leading=15,textColor=navy,spaceBefore=14)
def fmt(t):
    t=t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
    t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
    return re.sub(r'`([^`]+)`',r'<font face="DVM">\1</font>',t)
lines=open('source.md',encoding='utf-8').read().splitlines()
story=[]; block=[]
def flush():
    global block
    if block: story.append(KeepTogether(block)); block=[]
for ln in lines:
    s=ln.strip()
    if not s: continue
    if s.startswith('# '): story.append(Paragraph(fmt(s[2:]),H1))
    elif s.startswith('**Duration'): story.append(Paragraph(fmt(s),META)); story.append(HRFlowable(width='100%',color=colors.HexColor('#dde1ea'),thickness=1,spaceAfter=4))
    elif s.startswith('## '): flush(); block=[Paragraph(fmt(s[3:]),DAY)]
    elif s.startswith('### '): block.append(Paragraph(fmt(s[4:]),SEC))
    elif s.startswith('- '): block.append(Paragraph('•&nbsp;&nbsp;'+fmt(s[2:]),ITEM))
    elif re.match(r'^\d+\. ',s): n,rest=s.split(' ',1); block.append(Paragraph(n+'&nbsp;&nbsp;'+fmt(rest),ITEM))
    elif s=='---': continue
    elif s.startswith('**End'): flush(); story.append(Paragraph(fmt(s),END))
flush()
def foot(c,d):
    c.saveState(); c.setFont('DV',8); c.setFillColor(grey)
    c.drawString(18*mm,10*mm,'Python Foundations – Notes of Lesson'); c.drawRightString(A4[0]-18*mm,10*mm,f'Page {d.page}'); c.restoreState()
doc=SimpleDocTemplate('Python_Foundations_Notes_of_Lesson.pdf',pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,topMargin=16*mm,bottomMargin=18*mm,title='Python Foundations – Notes of Lesson',author='Brightpath Tech Academy')
doc.build(story,onFirstPage=foot,onLaterPages=foot)
