"""Extract HALC codebook dictionaries using only Python's standard library."""
import json
from pathlib import Path
import posixpath
import zipfile
import xml.etree.ElementTree as ET

NS = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

def read_sheets(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings = [''.join(el.itertext()) for el in root.findall('s:si', NS)]
        relationships = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        targets = {r.get('Id'):r.get('Target') for r in relationships}
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        result = {}
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            target = targets[sheet.get('{'+REL+'}id')]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            sheet_root = ET.fromstring(z.read(target))
            rows = []
            for row in sheet_root.findall('s:sheetData/s:row', NS):
                values = []
                for cell in row.findall('s:c', NS):
                    letters = ''.join(c for c in cell.get('r') if c.isalpha())
                    column = 0
                    for letter in letters:
                        column = column*26 + ord(letter)-64
                    while len(values) < column:
                        values.append(None)
                    value = cell.find('s:v', NS)
                    kind = cell.get('t')
                    if kind == 'inlineStr':
                        value = ''.join(cell.find('s:is', NS).itertext())
                    elif value is None:
                        value = None
                    elif kind == 's':
                        value = strings[int(value.text)]
                    elif kind == 'b':
                        value = value.text == '1'
                    else:
                        try:
                            number = float(value.text)
                            value = int(number) if number.is_integer() else number
                        except (TypeError,ValueError):
                            value = value.text
                    values[column-1] = value
                rows.append(values)
            result[sheet.get('name')] = rows
        return result

def extract(codebook, destination):
    sheets = read_sheets(codebook)
    def pad(row, count): return row + [None] * max(0,count-len(row))
    fields = {}
    for row in sheets['Polygons'][2:]:
        r = pad(row,6)
        if r[0]: fields[r[0]] = {'type':r[1],'description':r[4],'example':r[5]}
    regions = {}
    for row in sheets['Codes regions'][1:]:
        r = pad(row,6)
        if r[4] and len(str(r[4])) == 2:
            regions[str(r[4])] = {'nl':r[2],'en':r[3],'color':r[5]}
    bibliography = {}
    for row in sheets['Bibliography'][1:]:
        r = pad(row,2)
        if r[0]: bibliography[str(r[0])] = {'citation':r[1],'urls':[v for v in r[2:] if v]}
    subdivisions = {}
    for row in sheets['Administrative subdivisions'][1:]:
        r = pad(row,11)
        if r[1]: subdivisions[r[1]] = {'region':r[0],**{f'ADM{n}':r[n] for n in range(2,10)},'source':r[10]}
    legends = {
      'TYPE': {
       '0':{'zh':'行政或司法单位','en':'Administrative or judicial unit'},
       '1':{'zh':'宗教单位','en':'Religious unit'},
       '2':{'zh':'行政、司法与宗教区划合一','en':'Combined administrative/judicial and religious unit'},
       '8':{'zh':'自然要素','en':'Exclusively natural feature'},
       '9':{'zh':'类型不明','en':'Unclear type'}},
      'QUALITY': {
       '0':{'zh':'主要依据近同期历史重建','en':'Primarily near-contemporary historical reconstruction'},
       '1':{'zh':'主要依据其他时期历史重建','en':'Primarily non-contemporary historical reconstruction'},
       '2':{'zh':'主要参照现代边界','en':'Primarily based on modern boundaries'},
       '3':{'zh':'主要参照地理或自然特征估计','en':'Estimated substantially from geographical or natural features'},
       '4':{'zh':'主要参照历史边界估计','en':'Estimated substantially from historical boundaries'},
       '8':{'zh':'混合来源','en':'Combination of sources'},
       '9':{'zh':'位置未识别','en':'Unidentified location'}},
      'ADM0':{'ENG':{'zh':'英格兰','en':'England'},'FRA':{'zh':'法国','en':'France'},'HRR':{'zh':'神圣罗马帝国','en':'Holy Roman Empire'}},
      'specialADM1':{'XX':{'zh':'小型独立领地','en':'Small sovereign regions','isSingleState':False}},
      'sharedMembership':{'separator':';','preserveOrder':True,
        'zh':'共有或争议归属','en':'Shared or contested affiliation'},
      'translationNote':'Chinese legend translations are editorial; original English definitions remain in polygon-fields.json.'
    }
    assert len(fields) == 55 and len(regions) == 68 and len(bibliography) == 246
    destination.mkdir(parents=True,exist_ok=True)
    for filename,data in [('polygon-fields.json',fields),('region-codes.json',regions),
                          ('bibliography.json',bibliography),('administrative-subdivisions.json',subdivisions),
                          ('legends.json',legends)]:
        (destination/filename).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codebook', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True, help='Metadata directory')
    args = parser.parse_args()
    extract(args.codebook, args.output)
