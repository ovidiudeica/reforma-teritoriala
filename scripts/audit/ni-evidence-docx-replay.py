from pathlib import Path
import hashlib,json,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
base=root/'docs/evidence/ni-jur-independent-20261020/documentary'
namespace={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def text(element):
    parts=[]
    for child in element.iter():
        if child.tag=='{'+namespace['w']+'}t':parts.append(child.text or '')
        elif child.tag=='{'+namespace['w']+'}tab':parts.append('\t')
        elif child.tag=='{'+namespace['w']+'}br':parts.append('\n')
    return ''.join(parts)
for identifier in ['PMR-ATD-ANNEX1-133268','PMR-ATD-ANNEX2-133269']:
    expected=json.loads((base/(identifier+'-text.json')).read_text(encoding='utf8'))
    digest=expected['original_sha256'];assert len(digest)==64 and all(c in '0123456789abcdef' for c in digest)
    original=base/'originals'/(digest+'.original');raw=original.read_bytes();assert hashlib.sha256(raw).hexdigest()==digest
    with zipfile.ZipFile(original) as archive:
        member=archive.getinfo('word/document.xml');assert member.file_size<5_000_000
        xml=ET.fromstring(archive.read(member))
    body=xml.find('w:body',namespace);assert body is not None
    paragraphs=[text(p).strip() for p in body.findall('w:p',namespace) if text(p).strip()]
    assert paragraphs==[p['text'] for p in expected['paragraphs']],identifier
    observed_tables=[]
    for table in body.findall('w:tbl',namespace):
        expanded=[]
        for row in table.findall('w:tr',namespace):
            cells=[]
            for cell in row.findall('w:tc',namespace):
                span=cell.find('w:tcPr/w:gridSpan',namespace)
                width=int(span.get('{'+namespace['w']+'}val')) if span is not None else 1
                value='\n'.join(text(p) for p in cell.findall('w:p',namespace))
                merge=cell.find('w:tcPr/w:vMerge',namespace)
                if merge is not None and merge.get('{'+namespace['w']+'}val')!='restart':
                    assert expanded and len(cells)<len(expanded[-1])
                    value=expanded[-1][len(cells)]
                cells.extend([value]*width)
            expanded.append(cells)
        observed_tables.append(expanded)
    assert observed_tables==expected['tables'],(identifier,'ordered table/alias pairs differ')
    print('PASS original DOCX replay',identifier,len(paragraphs),'paragraphs')
fixture=ET.fromstring('<w:tc xmlns:w="'+namespace['w']+'"><w:p><w:r><w:t>A</w:t></w:r></w:p><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>')
assert '\n'.join(text(p) for p in fixture.findall('w:p',namespace))=='A\nB'
print('PASS preserve cell paragraph boundaries and ordered alias rows')
print('NI_DOCUMENTARY_ORIGINAL_REPLAY_PASS_NO_LEGAL_PROMOTION')
