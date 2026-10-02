"""Apply conservative, audited display labels without touching upstream identity fields."""
import json,pathlib,gzip,collections
root=pathlib.Path(__file__).parent;out=root/'assets'
cat=json.loads((out/'catalog.json').read_text());labels=json.loads((root/'wikidata-labels.json').read_text());identities=json.loads((root/'wikipedia-identities.json').read_text());manual=json.loads((root/'manual-translations.json').read_text())['translations']
counts=collections.Counter();audit=[]
for r in cat['records']:
 q=r['wikidata'];p=identities.get(r['wikipedia'],{});l=labels.get(q,{})
 canonical_q=p.get('wikidata');warnings=[];name=r['name']
 match=bool(canonical_q and q and canonical_q==q)
 mismatch=bool(canonical_q and q and canonical_q!=q)
 r['verifiedWikidata']=canonical_q
 r['wikipediaCanonicalTitle']=p.get('canonicalTitle')
 r['enName']=l.get('en') if match and r['type']=='POLITY' else None
 r['zhName']=l.get('zh') if match and r['type']=='POLITY' else None
 r['zhLanguage']=l.get('zhLanguage') if r['zhName'] else None
 r['nameTranslationStatus']='verified_wikidata_entity_label' if r['zhName'] else 'original_name'
 r['translationNote']='中文名为与源Wikipedia词条对应的Wikidata标签；原始名称保留。' if r['zhName'] else '暂无通过身份核对的中文标签，显示源数据原名。'
 if mismatch:
  warnings.append('上游Wikidata ID '+str(q)+' 与原Wikipedia词条对应ID '+str(canonical_q)+' 不一致；未使用该ID的自动译名。')
  counts['qidMismatchRecords']+=1
  audit.append({'id':r['id'],'name':name,'sourceWikidata':q,'wikipedia':r['wikipedia'],'wikipediaWikidata':canonical_q})
 elif q and not canonical_q:
  warnings.append('尚无法用原Wikipedia词条核对上游Wikidata ID，未自动采用其中文标签。')
  counts['unverifiedIdentityRecords']+=1
 if r['type']=='RELATION':
  warnings.append('关系范围（联盟、效忠或共主联合），可能与组成政体重叠；关联百科ID可能描述参与者或统治者。')
  r['enName']=None;r['zhName']=None;r['zhLanguage']=None;r['nameTranslationStatus']='original_name';r['translationNote']='关系名称保留原文，避免以参与者或统治者名称代替关系。'
 # Even a correct QID may link a historical survey/list rather than a polity.
 if match and r['type']=='POLITY' and l.get('en','') and any(x in l['en'].lower() for x in ['history of ','list of ','archaeological ','prehistoric ']):
  r['zhName']=None;r['enName']=None;r['zhLanguage']=None;r['nameTranslationStatus']='original_name'
  warnings.append('百科实体标签描述历史主题或列表，未作为政体译名。')
 if name in manual and r['type']=='POLITY':
  r['zhName']=manual[name];r['zhLanguage']='zh-Hans';r['nameTranslationStatus']='editorial_exact_name'
  r['translationNote']='按源数据完整名称人工译名，保留国家、王朝及阶段区分。'
  counts['editorialTranslationRecords']+=1
 if name=='Later Zhou' and r['end']<0:
  r['zhName']=None;r['enName']=None;r['zhLanguage']=None;r['nameTranslationStatus']='ambiguous_source_period'
  r['translationNote']='源名称和百科关联存在年代歧义，保留原名，暂不译为后周。'
  warnings.append('源数据把Later Zhou用于公元前区间，却关联公元951—960年的后周词条；名称/实体身份尚需历史核查，疆域与日期保持源记录。')
  counts['ambiguousPeriodRecords']+=1
  counts['editorialTranslationRecords']-=1
 if r['start']==0 or r['end']==0:
  warnings.append('源数据含公元0年端点；本图保留源区间且时间轴跳过0年。')
 if r['id'] in cat['metadata']['sourceInvalidGeometryRecordIds']:
  warnings.append('源多边形含几何有效性问题，未静默修补；仅用于概览展示。')
 if name=='Hashemite Arab Federation' and r['end']<1900:
  r['zhName']=None;r['enName']=None;r['zhLanguage']=None;r['nameTranslationStatus']='ambiguous_source_period'
  r['translationNote']='源名称、Arab Iraq百科词条及中世纪年代的对应关系未核实，保留原名。'
  warnings.append('Hashemite Arab Federation被用于1415—1439年，却指向Arab Iraq词条；名称与历史时期的对应关系未核实。')
  counts['ambiguousPeriodRecords']+=1
 r['evidenceWarnings']=warnings
 warning_en=[]
 for warning in warnings:
  if warning.startswith('上游Wikidata ID '): warning_en.append(f'Upstream Wikidata ID {q} differs from {canonical_q}, the item linked by the source Wikipedia article. Automatic labels from the mismatched ID were not used.')
  elif warning.startswith('尚无法用原Wikipedia'): warning_en.append('The upstream Wikidata ID could not be checked against the source Wikipedia article; its automatic Chinese label was not applied.')
  elif warning.startswith('关系范围'): warning_en.append('This is a relationship extent (alliance, allegiance, or personal union) and may overlap its constituent polities. The encyclopedia item may describe a participant or ruler.')
  elif warning.startswith('百科实体标签'): warning_en.append('The encyclopedia label describes a historical topic or list, so it was not used as a polity name.')
  elif warning.startswith('源数据把Later Zhou'): warning_en.append('The source uses Later Zhou for a BCE interval but links the Later Zhou dynasty of 951–960 CE. The entity identity requires historical review; source dates and geometry are unchanged.')
  elif warning.startswith('源数据含公元0年'): warning_en.append('The source contains a year-zero endpoint. Source intervals are retained, while the civil-year timeline skips zero.')
  elif warning.startswith('源多边形'): warning_en.append('The upstream polygon has a geometry-validity issue and was not silently repaired. It is suitable only for overview display.')
  elif warning.startswith('Hashemite Arab Federation'): warning_en.append('The source applies Hashemite Arab Federation to 1415–1439 while linking the Arab Iraq article. The name-period association has not been verified.')
  else: warning_en.append('An upstream data caveat requires review; consult the original record.')
 r['evidenceWarningsEn']=warning_en
 r['translationNoteEn']={
  'editorial_exact_name':'Editorial Chinese translation of the complete source name; state, dynasty and historical-phase distinctions are retained.',
  'verified_wikidata_entity_label':'Chinese label from the Wikidata item linked by the source Wikipedia article; the original name is retained.',
  'original_name':'No Chinese label passed the identity check; the original source name is retained.',
  'ambiguous_source_period':'The source name, linked entity and historical period have an unresolved identity ambiguity; the original name is retained.'
 }.get(r['nameTranslationStatus'],'Original source name retained.')
 if r['type']=='RELATION': r['translationNoteEn']='The relationship name is retained rather than replaced with the name of a participant or ruler.'
 if r['zhName']:counts['recordsWithZh']+=1
 if match:counts['qidMatchRecords']+=1
cat['metadata']['counts']['recordsWithZh']=counts['recordsWithZh']
cat['metadata']['labelAudit']={'wikidataEntitiesFetched':len(labels),'wikidataWithChineseLabel':sum(bool(x.get('zh')) for x in labels.values()),'wikipediaTitlesAudited':len(identities),'manualExactNameTranslations':len(manual),**counts}
cat['metadata']['namesWarningZh']='自动中文名仅在原Wikidata ID与源Wikipedia词条身份相符时使用；错误关联保留源信息并加警示，183个重要政体按完整原名人工翻译。所有记录保留原始name、wikidata、wikipedia；verifiedWikidata另载按Wikipedia核得的实体。缺译名以原名显示。'
cat['metadata']['identityAuditScope']='Checks cross-link identity consistency, not the historical correctness of upstream names, dates, geometries, or source citations.'
encoded=json.dumps(cat,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode();(out/'catalog.json').write_bytes(encoded);(out/'catalog.json.gz').write_bytes(gzip.compress(encoded,compresslevel=9,mtime=0))
(out/'metadata.json').write_text(json.dumps(cat['metadata'],ensure_ascii=False,indent=2))
(out/'identity-audit.json').write_text(json.dumps({'summary':cat['metadata']['labelAudit'],'mismatches':audit},ensure_ascii=False,indent=2))
(out/'manual-translations.json').write_bytes((root/'manual-translations.json').read_bytes())
print(json.dumps(cat['metadata']['labelAudit'],ensure_ascii=False,indent=2));print('catalogBytes',len(encoded),'gzipBytes',(out/'catalog.json.gz').stat().st_size)
